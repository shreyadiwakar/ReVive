import {
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  ConfirmForgotPasswordCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  GetUserCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda'

const region = process.env.AWS_REGION ?? 'us-east-1'
const dynamoClient = new DynamoDBClient({
  region,
  ...(process.env.DDB_ENDPOINT ? { endpoint: process.env.DDB_ENDPOINT } : {}),
})
const dynamo = DynamoDBDocumentClient.from(dynamoClient)
const cognito = new CognitoIdentityProviderClient({ region })
const tableName = process.env.TABLE_NAME
const clientId = process.env.USER_POOL_CLIENT_ID
const userPoolId = process.env.USER_POOL_ID
const localAuthEnabled = process.env.LOCAL_AUTH === 'true'

const allowedCategories = new Set([
  'Plastic', 'Paper', 'Glass', 'Metal', 'E-waste', 'Organic', 'Other',
])
const pointsPerKg: Record<string, number> = {
  Plastic: 20, Paper: 15, Glass: 18, Metal: 25, 'E-waste': 30, Organic: 10, Other: 12,
}
const vehicleWeightLimitKg: Record<string, number> = {
  'Bicycle cart': 25,
  'Motorcycle with crate': 40,
  'Auto rickshaw': 150,
  'Electric cargo van': 500,
  'Mini truck': 1000,
}
const cancellableStatuses = ['Requested', 'Accepted', 'Pickup Scheduled']

function validCoordinates(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
}

function haversineKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const dLat = radians(to.latitude - from.latitude)
  const dLon = radians(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function derivePasswordHash(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

function accountProfile(input: {
  id: string; email: string; name: string; role?: string; phone?: string; address?: string; city?: string;
  approvalStatus?: string; centerId?: string; latitude?: number; longitude?: number; [key: string]: unknown
}) {
  const createdAt = new Date().toISOString()
  return {
    ...input,
    PK: `ACCOUNT#${input.id}`,
    SK: 'PROFILE',
    id: input.id,
    role: input.role ?? 'user',
    email: input.email,
    name: input.name,
    phone: input.phone?.trim() ?? '',
    address: input.address?.trim() ?? '',
    city: input.city?.trim() ?? '',
    status: 'active',
    approvalStatus: input.approvalStatus ?? 'approved',
    points: 0,
    createdAt,
    updatedAt: createdAt,
    GSI1PK: `EMAIL#${input.email}`,
    GSI1SK: `ACCOUNT#${input.id}`,
  }
}

function publicAccount(item: Record<string, unknown>): Record<string, unknown> {
  const { PK: _pk, SK: _sk, GSI1PK: _gsiPk, GSI1SK: _gsiSk, passwordSalt: _salt, passwordHash: _hash, ...profile } = item
  return profile
}

async function localSignUp(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{
    email?: string; password?: string; name?: string; role?: string; phone?: string; address?: string; city?: string;
    centerName?: string; contactPerson?: string; acceptedCategories?: string[]; operatingHours?: string; description?: string;
    serviceArea?: string; vehicleType?: string; vehicleReg?: string;
    latitude?: number; longitude?: number;
  }>(event.body, event.isBase64Encoded)
  const email = input?.email?.trim().toLowerCase()
  const password = input?.password
  const role = input?.role ?? 'user'
  const name = (role === 'center' ? input?.centerName : input?.name)?.trim()
  if (!email || !password || password.length < 8 || !name || !email.includes('@')) {
    return json(400, { error: 'Enter a valid email, a name, and a password with at least 8 characters.' })
  }
  if (!['user', 'delivery', 'center'].includes(role)) return json(400, { error: 'This account role cannot self-register.' })
  if (!input.address?.trim() || !input.city?.trim()) {
    return json(400, { error: 'A street address and city are required.' })
  }
  if (!Number.isFinite(input.latitude) || input.latitude! < -90 || input.latitude! > 90
    || !Number.isFinite(input.longitude) || input.longitude! < -180 || input.longitude! > 180) {
    return json(400, { error: 'Locate the address on the map before creating an account.' })
  }
  if (role === 'center' && (!input.contactPerson?.trim() || !input.acceptedCategories?.length)) {
    return json(400, { error: 'Center contact and accepted categories are required.' })
  }
  if (role === 'delivery' && (!input.serviceArea?.trim() || !input.vehicleType?.trim() || !input.vehicleReg?.trim())) {
    return json(400, { error: 'Delivery service area and vehicle details are required.' })
  }

  const id = randomUUID()
  let matchingCenter: Record<string, unknown> | undefined
  if (role === 'center') {
    const existingCenters = await dynamo.send(new ScanCommand({
      TableName: requireTable(),
      FilterExpression: 'begins_with(PK, :center) AND SK = :profile',
      ExpressionAttributeValues: { ':center': 'CENTER#', ':profile': 'PROFILE' },
    }))
    matchingCenter = existingCenters.Items?.find((center) =>
      String(center.name).trim().toLowerCase() === name.toLowerCase()
      && String(center.city).trim().toLowerCase() === String(input.city).trim().toLowerCase()
      && !center.GSI1PK)
  }
  const centerId = role === 'center'
    ? String(matchingCenter?.id ?? `center_${randomUUID()}`)
    : undefined
  const salt = randomBytes(16).toString('hex')
  const passwordHash = (await derivePasswordHash(password, salt)).toString('hex')
  const profile = accountProfile({
    id, email, name, role, phone: input?.phone, address: input?.address, city: input?.city,
    approvalStatus: role === 'user' ? 'approved' : 'pending', centerId,
    latitude: input.latitude!, longitude: input.longitude!,
    ...(role === 'center' ? {
      contactPerson: input.contactPerson?.trim(), acceptedCategories: input.acceptedCategories,
      operatingHours: input.operatingHours?.trim() ?? '', description: input.description?.trim() ?? '',
      available: false, businessVerified: false,
    } : {}),
    ...(role === 'delivery' ? {
      serviceArea: input.serviceArea?.trim(), vehicleType: input.vehicleType?.trim(),
      vehicleReg: input.vehicleReg?.trim(), identityVerified: false,
    } : {}),
  })
  const transactionItems: NonNullable<TransactWriteCommandInput['TransactItems']> = [
    { Put: { TableName: requireTable(), Item: profile, ConditionExpression: 'attribute_not_exists(PK)' } },
    { Put: { TableName: requireTable(), Item: { PK: `LOCAL_EMAIL#${email}`, SK: 'UNIQUE', id, passwordSalt: salt, passwordHash }, ConditionExpression: 'attribute_not_exists(PK)' } },
  ]
  if (role === 'center' && centerId) {
    const centerItem: Record<string, unknown> = {
      ...(matchingCenter ?? {}),
      PK: `CENTER#${centerId}`, SK: 'PROFILE', id: centerId, ownerId: id, name, city: input.city!.trim(),
      address: input.address!.trim(), phone: input.phone?.trim() ?? '', acceptedCategories: input.acceptedCategories!, operatingHours: input.operatingHours?.trim() ?? '',
      description: input.description?.trim() ?? '', available: false, approvalStatus: 'pending',
      latitude: input.latitude!, longitude: input.longitude!,
      GSI1PK: `OWNER#${id}`, GSI1SK: `CENTER#${centerId}`,
    }
    delete centerItem.GSI2PK
    delete centerItem.GSI2SK
    transactionItems.push({ Put: {
      TableName: requireTable(), Item: centerItem,
      ConditionExpression: matchingCenter ? 'attribute_not_exists(GSI1PK)' : 'attribute_not_exists(PK)',
    } })
  }
  try {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: transactionItems,
    }))
    return json(201, { status: 'confirmed', session: { ...publicAccount(profile), backendUser: true } })
  } catch (error) {
    if ((error as { name?: string })?.name === 'TransactionCanceledException') {
      return json(409, { error: 'An account with this email already exists.' })
    }
    throw error
  }
}

async function localLogin(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{ email?: string; password?: string }>(event.body, event.isBase64Encoded)
  const email = input?.email?.trim().toLowerCase()
  const password = input?.password
  if (!email || !password) return json(400, { error: 'Email and password are required.' })
  const result = await dynamo.send(new GetCommand({
    TableName: requireTable(),
    Key: { PK: `LOCAL_EMAIL#${email}`, SK: 'UNIQUE' },
    ConsistentRead: true,
  }))
  const credentials = result.Item
  if (!credentials || typeof credentials.passwordSalt !== 'string' || typeof credentials.passwordHash !== 'string') {
    return json(401, { error: 'Invalid email or password.' })
  }
  const expected = Buffer.from(credentials.passwordHash, 'hex')
  const actual = await derivePasswordHash(password, credentials.passwordSalt)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return json(401, { error: 'Invalid email or password.' })
  }
  const account = await dynamo.send(new GetCommand({
    TableName: requireTable(),
    Key: { PK: `ACCOUNT#${String(credentials.id)}`, SK: 'PROFILE' },
    ConsistentRead: true,
  }))
  if (!account.Item) return json(401, { error: 'Invalid email or password.' })
  return json(200, { session: { ...publicAccount(account.Item), backendUser: true } })
}

async function getAccountProfile(subject: string) {
  const result = await dynamo.send(new GetCommand({
    TableName: requireTable(),
    Key: { PK: `ACCOUNT#${subject}`, SK: 'PROFILE' },
  }))
  if (!result.Item) return json(404, { error: 'Account profile not found.' })
  return json(200, { profile: publicAccount(result.Item) })
}

async function updateAccountProfile(event: Parameters<APIGatewayProxyHandlerV2>[0], subject: string) {
  const input = readBody<{
    name?: string; phone?: string; address?: string; city?: string; contactPerson?: string;
    acceptedCategories?: string[]; operatingHours?: string; description?: string;
    serviceArea?: string; vehicleType?: string; vehicleReg?: string;
    latitude?: number | null; longitude?: number | null;
  }>(event.body, event.isBase64Encoded)
  if (!input || !input.name?.trim()) return json(400, { error: 'A name is required.' })
  if ((input.latitude == null) !== (input.longitude == null)
    || (input.latitude != null && (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90
      || !Number.isFinite(input.longitude) || input.longitude! < -180 || input.longitude! > 180))) {
    return json(400, { error: 'Provide a valid latitude and longitude pair.' })
  }
  const result = await dynamo.send(new UpdateCommand({
    TableName: requireTable(),
    Key: { PK: `ACCOUNT#${subject}`, SK: 'PROFILE' },
    UpdateExpression: 'SET #name = :name, phone = :phone, address = :address, city = :city, contactPerson = :contactPerson, acceptedCategories = :acceptedCategories, operatingHours = :operatingHours, description = :description, serviceArea = :serviceArea, vehicleType = :vehicleType, vehicleReg = :vehicleReg, latitude = :latitude, longitude = :longitude, updatedAt = :updatedAt',
    ConditionExpression: 'attribute_exists(PK)',
    ExpressionAttributeNames: { '#name': 'name' },
    ExpressionAttributeValues: {
      ':name': input.name.trim().slice(0, 120),
      ':phone': input.phone?.trim().slice(0, 32) ?? '',
      ':address': input.address?.trim().slice(0, 300) ?? '',
      ':city': input.city?.trim().slice(0, 120) ?? '',
      ':contactPerson': input.contactPerson?.trim().slice(0, 120) ?? '',
      ':acceptedCategories': input.acceptedCategories ?? [],
      ':operatingHours': input.operatingHours?.trim().slice(0, 120) ?? '',
      ':description': input.description?.trim().slice(0, 1000) ?? '',
      ':serviceArea': input.serviceArea?.trim().slice(0, 300) ?? '',
      ':vehicleType': input.vehicleType?.trim().slice(0, 100) ?? '',
      ':vehicleReg': input.vehicleReg?.trim().slice(0, 100) ?? '',
      ':latitude': input.latitude ?? null,
      ':longitude': input.longitude ?? null,
      ':updatedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  }))
  if (!result.Attributes) return json(404, { error: 'Account profile not found.' })
  if (result.Attributes.role === 'center' && typeof result.Attributes.centerId === 'string') {
    await dynamo.send(new UpdateCommand({
      TableName: requireTable(), Key: { PK: `CENTER#${result.Attributes.centerId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET #name = :name, contactPerson = :contactPerson, phone = :phone, address = :address, city = :city, acceptedCategories = :acceptedCategories, operatingHours = :operatingHours, description = :description, latitude = :latitude, longitude = :longitude',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':name': input.name.trim().slice(0, 120),
        ':contactPerson': input.contactPerson?.trim().slice(0, 120) ?? '',
        ':phone': input.phone?.trim().slice(0, 32) ?? '',
        ':address': input.address?.trim().slice(0, 300) ?? '',
        ':city': input.city?.trim().slice(0, 120) ?? '',
        ':acceptedCategories': input.acceptedCategories ?? [],
        ':operatingHours': input.operatingHours?.trim().slice(0, 120) ?? '',
        ':description': input.description?.trim().slice(0, 1000) ?? '',
        ':latitude': input.latitude ?? null,
        ':longitude': input.longitude ?? null,
      },
    }))
  }
  return json(200, { profile: publicAccount(result.Attributes) })
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function readBody<T>(body?: string, isBase64Encoded?: boolean): T | null {
  if (!body) return null
  try {
    const decoded = isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body
    return JSON.parse(decoded) as T
  } catch {
    return null
  }
}

function providerError(error: unknown) {
  const name = (error as { name?: string })?.name
  if (name === 'UsernameExistsException') return json(409, { error: 'An account with this email already exists.' })
  if (name === 'NotAuthorizedException') return json(401, { error: 'Invalid email or password.' })
  if (name === 'UserNotConfirmedException') return json(403, { error: 'Confirm your email before signing in.' })
  if (name === 'CodeMismatchException' || name === 'ExpiredCodeException') {
    return json(400, { error: 'The confirmation code is invalid or expired.' })
  }
  if (name === 'InvalidPasswordException' || name === 'InvalidParameterException') {
    return json(400, { error: 'Check the submitted account details and password requirements.' })
  }
  console.error('Cognito request failed:', error)
  return json(502, { error: 'Identity provider request failed.' })
}

function authenticatedSubject(event: APIGatewayProxyEventV2) {
  const context = event.requestContext as APIGatewayProxyEventV2WithJWTAuthorizer['requestContext']
  const claims = context.authorizer?.jwt?.claims
  return typeof claims?.sub === 'string' ? claims.sub : null
}

function normalizeCognitoGroupClaimValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeCognitoGroupClaimValue(entry))
  }

  if (typeof value !== 'string') return []

  const claim = value.trim()
  if (!claim) return []

  try {
    const parsed = JSON.parse(claim)
    return normalizeCognitoGroupClaimValue(parsed)
  } catch {
    // API Gateway sometimes serializes an array-valued JWT claim as a string.
    // Some authorizers emit the array as single-quoted or comma-delimited text.
  }

  return claim
    .split(',')
    .map((entry) => entry.trim().replace(/^[\[\]"'\\]+|[\[\]"'\\]+$/g, ''))
    .filter((entry) => entry.length > 0)
}

function safeCognitoGroupDiagnostics(event: APIGatewayProxyEventV2, group: string) {
  const context = event.requestContext as APIGatewayProxyEventV2WithJWTAuthorizer['requestContext']
  const claims = context.authorizer?.jwt?.claims ?? {}
  const rawGroups = claims['cognito:groups'] ?? claims.groups
  const normalizedGroups = normalizeCognitoGroupClaimValue(rawGroups)

  return {
    method: event.requestContext.http?.method ?? 'UNKNOWN',
    path: event.rawPath ?? '/unknown',
    hasClaims: Object.keys(claims).length > 0,
    hasGroupClaim: typeof rawGroups !== 'undefined',
    claimType: Array.isArray(rawGroups) ? 'array' : typeof rawGroups,
    requestedGroup: group,
    normalizedGroups,
    matchesGroup: normalizedGroups.includes(group),
  }
}

export function hasCognitoGroupClaim(value: unknown, group: string) {
  return normalizeCognitoGroupClaimValue(value).includes(group)
}

export function hasCognitoGroup(event: APIGatewayProxyEventV2, group: string) {
  const context = event.requestContext as APIGatewayProxyEventV2WithJWTAuthorizer['requestContext']
  const claims = context.authorizer?.jwt?.claims ?? {}
  const groups = claims['cognito:groups'] ?? claims.groups
  return hasCognitoGroupClaim(groups, group)
}

async function signUp(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  if (localAuthEnabled) return localSignUp(event)
  const input = readBody<{
    email?: string; password?: string; name?: string; role?: string; phone?: string; address?: string; city?: string;
    centerName?: string; contactPerson?: string; acceptedCategories?: string[]; operatingHours?: string; description?: string;
    serviceArea?: string; vehicleType?: string; vehicleReg?: string; latitude?: number; longitude?: number;
  }>(event.body, event.isBase64Encoded)
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = input?.password
  const role = input?.role ?? 'user'
  const rawName = role === 'center' ? input?.centerName : input?.name
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!email || typeof password !== 'string' || password.length < 8 || !name || !email.includes('@')) {
    return json(400, { error: 'Enter a valid email, a name, and a password.' })
  }
  if (!['user', 'delivery', 'center'].includes(role)) {
    return json(400, { error: 'This account role cannot self-register.' })
  }
  if (typeof input?.address !== 'string' || !input.address.trim()
    || typeof input.city !== 'string' || !input.city.trim()) {
    return json(400, { error: 'A street address and city are required.' })
  }
  if (!validCoordinates(input.latitude, input.longitude)) {
    return json(400, { error: 'Locate the address on the map before creating an account.' })
  }
  if (role === 'center' && (typeof input.contactPerson !== 'string' || !input.contactPerson.trim()
    || !Array.isArray(input.acceptedCategories) || !input.acceptedCategories.length
    || input.acceptedCategories.some((category) => !allowedCategories.has(category)))) {
    return json(400, { error: 'Center contact and supported accepted categories are required.' })
  }
  if (role === 'delivery' && (typeof input.serviceArea !== 'string' || !input.serviceArea.trim()
    || typeof input.vehicleType !== 'string' || !input.vehicleType.trim()
    || typeof input.vehicleReg !== 'string' || !input.vehicleReg.trim())) {
    return json(400, { error: 'Delivery service area and vehicle details are required.' })
  }
  if (!clientId || !userPoolId) return json(500, { error: 'Identity provider is not configured.' })

  try {
    const result = await cognito.send(new SignUpCommand({
      ClientId: clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
      ],
    }))
    if (!result.UserSub) {
      try {
        await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: email }))
      } catch (cleanupError) {
        console.error('Could not remove the Cognito account without an identifier.', cleanupError)
      }
      return json(502, { error: 'Identity provider did not return an account identifier.' })
    }

    const id = result.UserSub
    const centerId = role === 'center' ? `center_${randomUUID()}` : undefined
    const profile = accountProfile({
      id, email, name, role, phone: input.phone, address: input.address, city: input.city,
      approvalStatus: role === 'user' ? 'approved' : 'pending', centerId,
      latitude: input.latitude, longitude: input.longitude,
      ...(role === 'center' ? {
        contactPerson: input.contactPerson?.trim(), acceptedCategories: input.acceptedCategories,
        operatingHours: input.operatingHours?.trim() ?? '', description: input.description?.trim() ?? '',
        available: false, businessVerified: false,
      } : {}),
      ...(role === 'delivery' ? {
        serviceArea: input.serviceArea?.trim(), vehicleType: input.vehicleType?.trim(),
        vehicleReg: input.vehicleReg?.trim(), identityVerified: false,
      } : {}),
    })
    const transactionItems: NonNullable<TransactWriteCommandInput['TransactItems']> = [
      { Put: { TableName: requireTable(), Item: profile, ConditionExpression: 'attribute_not_exists(PK)' } },
    ]
    if (role === 'center' && centerId) {
      transactionItems.push({ Put: {
        TableName: requireTable(),
        Item: {
          PK: `CENTER#${centerId}`, SK: 'PROFILE', id: centerId, ownerId: id,
          name, city: input.city.trim(), address: input.address.trim(), phone: input.phone?.trim() ?? '',
          acceptedCategories: input.acceptedCategories!, operatingHours: input.operatingHours?.trim() ?? '',
          description: input.description?.trim() ?? '', available: false, approvalStatus: 'pending',
          latitude: input.latitude!, longitude: input.longitude!,
          GSI1PK: `OWNER#${id}`, GSI1SK: `CENTER#${centerId}`,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      } })
    }
    try {
      await dynamo.send(new TransactWriteCommand({ TransactItems: transactionItems }))
    } catch (error) {
      try {
        await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: email }))
      } catch (cleanupError) {
        console.error('Could not remove the unprovisioned Cognito account after profile creation failed.', cleanupError)
      }
      if ((error as { name?: string })?.name === 'TransactionCanceledException') {
        return json(409, { error: 'An account with this email already exists.' })
      }
      throw error
    }

    return json(201, {
      status: result.UserConfirmed ? 'confirmed' : 'confirmation_required',
      userId: id,
      email,
      role,
      approvalStatus: profile.approvalStatus,
    })
  } catch (error) {
    return providerError(error)
  }
}

async function confirmSignUp(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{ email?: string; code?: string }>(event.body, event.isBase64Encoded)
  const email = input?.email?.trim().toLowerCase()
  const code = input?.code?.trim()
  if (!email || !code) return json(400, { error: 'Email and confirmation code are required.' })
  if (!clientId) return json(500, { error: 'Identity provider is not configured.' })

  try {
    await cognito.send(new ConfirmSignUpCommand({ ClientId: clientId, Username: email, ConfirmationCode: code }))
    return json(200, { status: 'confirmed' })
  } catch (error) {
    return providerError(error)
  }
}

async function requestPasswordReset(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{ email?: string }>(event.body, event.isBase64Encoded)
  const email = input?.email?.trim().toLowerCase()
  if (!email || !email.includes('@')) return json(400, { error: 'Enter a valid email address.' })
  if (!clientId) return json(500, { error: 'Identity provider is not configured.' })
  try {
    await cognito.send(new ForgotPasswordCommand({ ClientId: clientId, Username: email }))
    return json(200, { status: 'code_sent', message: 'If an account exists for that email, a reset code has been sent.' })
  } catch (error) {
    if (['UserNotFoundException', 'InvalidParameterException'].includes((error as { name?: string }).name ?? '')) {
      return json(200, { status: 'code_sent', message: 'If an account exists for that email, a reset code has been sent.' })
    }
    return providerError(error)
  }
}

async function confirmPasswordReset(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{ email?: string; code?: string; password?: string }>(event.body, event.isBase64Encoded)
  const email = input?.email?.trim().toLowerCase()
  const code = input?.code?.trim()
  const password = input?.password
  if (!email || !email.includes('@') || !code || typeof password !== 'string' || password.length < 8) {
    return json(400, { error: 'Enter your email, reset code, and a password with at least 8 characters.' })
  }
  if (!clientId) return json(500, { error: 'Identity provider is not configured.' })
  try {
    await cognito.send(new ConfirmForgotPasswordCommand({
      ClientId: clientId, Username: email, ConfirmationCode: code, Password: password,
    }))
    return json(200, { status: 'password_reset' })
  } catch (error) {
    return providerError(error)
  }
}

async function login(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  if (localAuthEnabled) return localLogin(event)
  const input = readBody<{ email?: string; password?: string }>(event.body, event.isBase64Encoded)
  const email = input?.email?.trim().toLowerCase()
  const password = input?.password
  if (!email || !password) return json(400, { error: 'Email and password are required.' })
  if (!clientId) return json(500, { error: 'Identity provider is not configured.' })

  try {
    const result = await cognito.send(new InitiateAuthCommand({
      ClientId: clientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))
    if (!result.AuthenticationResult) {
      return json(401, { error: 'Additional sign-in verification is required.' })
    }
    const accessToken = result.AuthenticationResult.AccessToken
    if (!accessToken) return json(401, { error: 'Sign-in did not return an access token.' })
    const user = await cognito.send(new GetUserCommand({ AccessToken: accessToken }))
    const subject = user.UserAttributes?.find((attribute) => attribute.Name === 'sub')?.Value
    if (!subject) return json(401, { error: 'Sign-in did not identify the account.' })
    const profile = await findOrProvisionCognitoProfile(subject, email, user.UserAttributes ?? [])
    if (!profile || profile.status !== 'active') {
      return json(403, { error: 'This account is not active or its profile is not provisioned.' })
    }
    const session = {
      ...publicAccount(profile),
      accessToken,
      idToken: result.AuthenticationResult.IdToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
      expiresIn: result.AuthenticationResult.ExpiresIn,
      tokenType: result.AuthenticationResult.TokenType,
      backendUser: true,
    }
    return json(200, {
      ...session,
      session,
    })
  } catch (error) {
    return providerError(error)
  }
}

async function findOrProvisionCognitoProfile(subject: string, username: string, attributes: { Name?: string; Value?: string }[]) {
  const key = { PK: `ACCOUNT#${subject}`, SK: 'PROFILE' }
  const existing = await dynamo.send(new GetCommand({ TableName: requireTable(), Key: key }))
  if (existing.Item) return existing.Item
  if (!userPoolId) throw new Error('USER_POOL_ID is not configured.')

  // Only legacy accounts with no Cognito group can safely receive the default resident role.
  // Partner/admin accounts need operator-provided business data and approval; never infer privilege.
  const memberships = await cognito.send(new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: username }))
  if (memberships.Groups?.length) return undefined
  const value = (name: string) => attributes.find((attribute) => attribute.Name === name)?.Value
  const email = value('email')?.trim().toLowerCase()
  if (!email || !value('email_verified') || value('email_verified') !== 'true') return undefined
  const name = value('name')?.trim() || email.split('@')[0]
  const profile = accountProfile({
    id: subject, email, name, role: 'user', phone: value('phone_number'),
    address: '', city: '', approvalStatus: 'approved',
  })
  try {
    await dynamo.send(new TransactWriteCommand({ TransactItems: [{ Put: {
      TableName: requireTable(), Item: profile, ConditionExpression: 'attribute_not_exists(PK)',
    } }] }))
    return profile
  } catch (error) {
    if ((error as { name?: string }).name !== 'TransactionCanceledException') throw error
    const raced = await dynamo.send(new GetCommand({ TableName: requireTable(), Key: key, ConsistentRead: true }))
    return raced.Item
  }
}

async function refreshSession(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{ refreshToken?: string }>(event.body, event.isBase64Encoded)
  if (!input?.refreshToken || !clientId) return json(400, { error: 'A refresh token is required.' })
  try {
    const result = await cognito.send(new InitiateAuthCommand({
      ClientId: clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: input.refreshToken },
    }))
    const tokens = result.AuthenticationResult
    if (!tokens?.AccessToken) return json(401, { error: 'Your session has expired. Sign in again.' })
    const user = await cognito.send(new GetUserCommand({ AccessToken: tokens.AccessToken }))
    const subject = user.UserAttributes?.find((attribute) => attribute.Name === 'sub')?.Value
    const email = user.UserAttributes?.find((attribute) => attribute.Name === 'email')?.Value?.toLowerCase()
    if (!subject || !email) return json(401, { error: 'Could not identify this account. Sign in again.' })
    const profile = await findOrProvisionCognitoProfile(subject, email, user.UserAttributes ?? [])
    if (!profile || profile.status !== 'active') return json(403, { error: 'This account is not active or its profile is not provisioned.' })
    const session = {
      ...publicAccount(profile), accessToken: tokens.AccessToken, idToken: tokens.IdToken,
      refreshToken: input.refreshToken, expiresIn: tokens.ExpiresIn, tokenType: tokens.TokenType,
      backendUser: true,
    }
    return json(200, { session })
  } catch (error) {
    return providerError(error)
  }
}

function requireTable() {
  if (!tableName) throw new Error('TABLE_NAME is not configured.')
  return tableName
}

function publicPickup(item: Record<string, unknown>) {
  const {
    PK: _pk,
    SK: _sk,
    GSI1PK: _gsi1pk,
    GSI1SK: _gsi1sk,
    GSI2PK: _gsi2pk,
    GSI2SK: _gsi2sk,
    GSI3PK: _gsi3pk,
    GSI3SK: _gsi3sk,
    ...pickup
  } = item
  return pickup
}

function requireSubject(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  return authenticatedSubject(event)
}

async function listPickups(event: Parameters<APIGatewayProxyHandlerV2>[0], subject: string) {
  const limitValue = Number(event.queryStringParameters?.limit ?? 25)
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 50) : 25
  const result = await dynamo.send(new QueryCommand({
    TableName: requireTable(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :resident AND begins_with(GSI1SK, :prefix)',
    ExpressionAttributeValues: {
      ':resident': `RESIDENT#${subject}`,
      ':prefix': 'PICKUP#',
    },
    Limit: limit,
    ScanIndexForward: false,
  }))
  const items = (result.Items ?? []).map(publicPickup)
  return json(200, { items })
}

async function listPartnerPickups(subject: string, available: boolean, event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  if (!(await isApprovedAccount(subject, 'delivery'))) return json(403, { error: 'This delivery partner application has not been approved.' })
  const limitValue = Number(event.queryStringParameters?.limit ?? 50)
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 50) : 25
  const result = await dynamo.send(new QueryCommand({
    TableName: requireTable(),
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :partition',
    ExpressionAttributeValues: {
      ':partition': available ? 'OPEN_PICKUPS' : `PARTNER#${subject}`,
    },
    Limit: limit,
    ScanIndexForward: available,
  }))
  return json(200, { items: (result.Items ?? []).map(publicPickup) })
}

async function getRewards(subject: string, event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const limitValue = Number(event.queryStringParameters?.limit ?? 25)
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 50) : 25
  const [balanceResult, rewardsResult] = await Promise.all([
    dynamo.send(new GetCommand({
      TableName: requireTable(),
      Key: { PK: `ACCOUNT#${subject}`, SK: 'POINTS#BALANCE' },
      ConsistentRead: true,
    })),
    dynamo.send(new QueryCommand({
      TableName: requireTable(),
      KeyConditionExpression: 'PK = :account AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':account': `ACCOUNT#${subject}`,
        ':prefix': 'REWARD#',
      },
      Limit: limit,
      ScanIndexForward: false,
    })),
  ])
  const transactions = (rewardsResult.Items ?? []).map(({ PK: _pk, SK: _sk, ...item }) => item)
  return json(200, { balance: balanceResult.Item?.points ?? 0, transactions })
}

async function listCoupons() {
  const result = await dynamo.send(new ScanCommand({
    TableName: requireTable(),
    FilterExpression: 'begins_with(PK, :coupon) AND SK = :meta AND active = :active',
    ExpressionAttributeValues: { ':coupon': 'COUPON#', ':meta': 'META', ':active': true },
  }))
  const items = (result.Items ?? []).map(({ PK: _pk, SK: _sk, ...coupon }) => coupon)
    .sort((a, b) => Number(a.pointsCost) - Number(b.pointsCost))
  return json(200, { items })
}

async function redeemCoupon(subject: string, event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{ couponId?: string; requestId?: string }>(event.body, event.isBase64Encoded)
  const couponId = input?.couponId?.trim()
  const requestId = input?.requestId?.trim()
  if (!couponId || !requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return json(400, { error: 'A coupon id and unique redemption request id are required.' })
  }

  const couponResult = await dynamo.send(new GetCommand({
    TableName: requireTable(), Key: { PK: `COUPON#${couponId}`, SK: 'META' }, ConsistentRead: true,
  }))
  const coupon = couponResult.Item
  const pointsCost = Number(coupon?.pointsCost)
  if (!coupon || coupon.active !== true || !Number.isSafeInteger(pointsCost) || pointsCost <= 0) {
    return json(404, { error: 'This coupon is unavailable.' })
  }
  const accountResult = await dynamo.send(new GetCommand({
    TableName: requireTable(), Key: { PK: `ACCOUNT#${subject}`, SK: 'PROFILE' }, ConsistentRead: true,
  }))
  if (accountResult.Item?.role !== 'user' || accountResult.Item?.status !== 'active') {
    return json(403, { error: 'Only active resident accounts can redeem coupons.' })
  }

  const occurredAt = new Date().toISOString()
  const rewardKey = `REWARD#${occurredAt}#${requestId}`
  const description = `Redeemed: ${String(coupon.title)}`
  const fulfillmentType = coupon.category === 'Cash' ? 'cash_request' : 'demo_voucher'
  const partnerCode = String(coupon.partner ?? 'REWARD').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'REWARD'
  const requestCode = requestId.replace(/[^a-z0-9]/gi, '').toUpperCase()
  const fulfillmentCode = coupon.category === 'Cash'
    ? undefined
    : `DEMO-${partnerCode}-${requestCode}`
  const fulfillmentStatus = 'completed'
  try {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: requireTable(),
            Key: { PK: `ACCOUNT#${subject}`, SK: 'POINTS#BALANCE' },
            UpdateExpression: 'SET updatedAt = :occurredAt ADD #points :deduction',
            ConditionExpression: '#points >= :cost',
            ExpressionAttributeNames: { '#points': 'points' },
            ExpressionAttributeValues: { ':occurredAt': occurredAt, ':deduction': -pointsCost, ':cost': pointsCost },
          },
        },
        {
          Put: {
            TableName: requireTable(),
            Item: {
              PK: `ACCOUNT#${subject}`, SK: rewardKey, id: requestId, residentId: subject,
              type: 'redeem', amount: -pointsCost, description, couponId, couponTitle: coupon.title,
              fulfillmentType,
              ...(coupon.category === 'Cash' ? {} : { fulfillmentCode }),
              fulfillmentStatus,
              createdAt: occurredAt,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        {
          Put: {
            TableName: requireTable(),
            Item: {
              PK: `ACCOUNT#${subject}`, SK: `REDEMPTION#${requestId}`,
              couponId, rewardKey, createdAt: occurredAt,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
      ],
    }))
  } catch (error) {
    if ((error as { name?: string })?.name === 'TransactionCanceledException') {
      const existing = await dynamo.send(new GetCommand({
        TableName: requireTable(), Key: { PK: `ACCOUNT#${subject}`, SK: `REDEMPTION#${requestId}` }, ConsistentRead: true,
      }))
      if (existing.Item?.couponId === couponId) {
        const balance = await dynamo.send(new GetCommand({
          TableName: requireTable(), Key: { PK: `ACCOUNT#${subject}`, SK: 'POINTS#BALANCE' }, ConsistentRead: true,
        }))
        const transaction = existing.Item.rewardKey
          ? await dynamo.send(new GetCommand({
            TableName: requireTable(), Key: { PK: `ACCOUNT#${subject}`, SK: existing.Item.rewardKey }, ConsistentRead: true,
          }))
          : undefined
        const { PK: _pk, SK: _sk, ...savedTransaction } = transaction?.Item ?? {}
        return json(200, {
          redeemed: true, duplicate: true, balance: balance.Item?.points ?? 0,
          ...(transaction?.Item ? { transaction: savedTransaction } : {}),
        })
      }
      const balance = await dynamo.send(new GetCommand({
        TableName: requireTable(), Key: { PK: `ACCOUNT#${subject}`, SK: 'POINTS#BALANCE' }, ConsistentRead: true,
      }))
      if (Number(balance.Item?.points ?? 0) < pointsCost) return json(409, { error: 'You do not have enough points for this coupon.' })
      return json(409, { error: 'This redemption request has already been used.' })
    }
    throw error
  }

  const balance = await dynamo.send(new GetCommand({
    TableName: requireTable(), Key: { PK: `ACCOUNT#${subject}`, SK: 'POINTS#BALANCE' }, ConsistentRead: true,
  }))
  return json(200, { redeemed: true, balance: balance.Item?.points ?? 0, transaction: {
    id: requestId, type: 'redeem', amount: -pointsCost, description, couponId,
    fulfillmentType,
    ...(coupon.category === 'Cash' ? {} : { fulfillmentCode }),
    fulfillmentStatus, createdAt: occurredAt,
  } })
}

async function listCenters(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const limitValue = Number(event.queryStringParameters?.limit ?? 25)
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 50) : 25
  const city = event.queryStringParameters?.city?.trim()
  const category = event.queryStringParameters?.category?.trim()
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = { ':available': 'AVAILABLE_CENTERS' }
  const filters: string[] = []
  if (city) {
    names['#city'] = 'city'
    values[':city'] = city
    filters.push('#city = :city')
  }
  if (category) {
    names['#categories'] = 'acceptedCategories'
    values[':category'] = category
    filters.push('contains(#categories, :category)')
  }
  const result = await dynamo.send(new QueryCommand({
    TableName: requireTable(),
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :available',
    ...(filters.length ? { FilterExpression: filters.join(' AND ') } : {}),
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
    ExpressionAttributeValues: values,
    Limit: limit,
    ScanIndexForward: true,
  }))
  const items = await Promise.all((result.Items ?? []).map(async (item) => {
    // Older center records may have a pin saved on the owner account before the
    // public center profile was synchronized. Fall back to that profile so
    // distance recommendations can still use the saved coordinates.
    let ownerProfile: Record<string, unknown> | undefined
    if ((!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) && typeof item.ownerId === 'string') {
      const owner = await dynamo.send(new GetCommand({
        TableName: requireTable(), Key: { PK: `ACCOUNT#${item.ownerId}`, SK: 'PROFILE' },
      }))
      ownerProfile = owner.Item
    }
    return {
      id: item.id,
      name: item.name,
      city: item.city,
      address: item.address,
      acceptedCategories: item.acceptedCategories,
      operatingHours: item.operatingHours,
      rating: item.rating,
      available: item.available,
      description: item.description,
      latitude: item.latitude ?? ownerProfile?.latitude,
      longitude: item.longitude ?? ownerProfile?.longitude,
    }
  }))
  return json(200, { items })
}

async function getOwnedCenter(ownerSub: string) {
  const centers = await dynamo.send(new QueryCommand({
    TableName: requireTable(), IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :owner AND begins_with(GSI1SK, :centerPrefix)',
    ExpressionAttributeValues: { ':owner': `OWNER#${ownerSub}`, ':centerPrefix': 'CENTER#' },
    Limit: 2,
  }))
  if (!centers.Items || centers.Items.length !== 1) return null
  const center = centers.Items[0]
  const account = await dynamo.send(new GetCommand({
    TableName: requireTable(), Key: { PK: `ACCOUNT#${ownerSub}`, SK: 'PROFILE' },
  }))
  if (account.Item?.role !== 'center' || account.Item.approvalStatus !== 'approved'
    || account.Item.status !== 'active' || center.ownerId !== ownerSub
    || center.approvalStatus !== 'approved') return null
  return center
}

async function isApprovedAccount(subject: string, role: string) {
  const result = await dynamo.send(new GetCommand({
    TableName: requireTable(), Key: { PK: `ACCOUNT#${subject}`, SK: 'PROFILE' },
  }))
  if (!result.Item) return false
  return result.Item.role === role && result.Item.approvalStatus === 'approved' && result.Item.status === 'active'
}

async function listCenterPickups(ownerSub: string) {
  const center = await getOwnedCenter(ownerSub)
  if (!center) return json(403, { error: 'This account must be assigned to exactly one recycling center.' })
  if (center.approvalStatus && center.approvalStatus !== 'approved') {
    return json(403, { error: 'This recycling center application has not been approved.' })
  }
  const result = await dynamo.send(new QueryCommand({
    TableName: requireTable(), IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3PK = :center',
    ExpressionAttributeValues: { ':center': `CENTER#${center.id}` },
    ScanIndexForward: true,
  }))
  return json(200, { items: (result.Items ?? []).map(publicPickup) })
}

async function getAdminSnapshot() {
  const [accountResult, pickupResult, rewardResult, configResult, pointsResult, couponResult, complaintResult] = await Promise.all([
    dynamo.send(new ScanCommand({
      TableName: requireTable(),
      FilterExpression: 'begins_with(PK, :account) AND SK = :profile',
      ExpressionAttributeValues: { ':account': 'ACCOUNT#', ':profile': 'PROFILE' },
    })),
    dynamo.send(new ScanCommand({
      TableName: requireTable(),
      FilterExpression: 'begins_with(PK, :pickup) AND SK = :meta',
      ExpressionAttributeValues: { ':pickup': 'PICKUP#', ':meta': 'META' },
    })),
    dynamo.send(new ScanCommand({
      TableName: requireTable(),
      FilterExpression: 'begins_with(PK, :account) AND begins_with(SK, :reward)',
      ExpressionAttributeValues: { ':account': 'ACCOUNT#', ':reward': 'REWARD#' },
    })),
    dynamo.send(new ScanCommand({
      TableName: requireTable(),
      FilterExpression: 'PK = :config AND begins_with(SK, :category)',
      ExpressionAttributeValues: { ':config': 'CONFIG#POINTS', ':category': 'CATEGORY#' },
    })),
    dynamo.send(new ScanCommand({
      TableName: requireTable(),
      FilterExpression: 'begins_with(PK, :account) AND SK = :balance',
      ExpressionAttributeValues: { ':account': 'ACCOUNT#', ':balance': 'POINTS#BALANCE' },
    })),
    dynamo.send(new ScanCommand({
      TableName: requireTable(),
      FilterExpression: 'begins_with(PK, :coupon) AND SK = :meta',
      ExpressionAttributeValues: { ':coupon': 'COUPON#', ':meta': 'META' },
    })),
    dynamo.send(new ScanCommand({
      TableName: requireTable(),
      FilterExpression: 'begins_with(PK, :complaint) AND SK = :meta',
      ExpressionAttributeValues: { ':complaint': 'COMPLAINT#', ':meta': 'META' },
    })),
  ])
  const pointsByUser = new Map((pointsResult.Items ?? []).map((item) => [
    String(item.PK).slice('ACCOUNT#'.length), Number(item.points ?? 0),
  ]))
  const users = (accountResult.Items ?? []).map((item): Record<string, unknown> => ({
    ...publicAccount(item as Record<string, unknown>),
    points: pointsByUser.get(String(item.id)) ?? 0,
  }))
  const userNames = new Map(users.map((user) => [user.id, user.name]))
  const accountRoles = new Map(users.map((user) => [user.id, user.role]))
  const accountRolesByName = new Map(users.map((user) => [String(user.name ?? '').toLowerCase(), user.role]))
  const rewardTransactions = (rewardResult.Items ?? []).map(({ PK: _pk, SK: _sk, ...item }) => ({
    ...item,
    userId: item.residentId,
    userName: userNames.get(String(item.residentId)) ?? 'Resident',
  }))
  const complaints = (complaintResult.Items ?? []).map(({ PK: _pk, SK: _sk, ...item }) => {
    const accountId = String(item.accountId ?? item.userId ?? item.residentId ?? item.submittedBy ?? '')
    const accountName = String(item.accountName ?? userNames.get(accountId) ?? 'Resident or partner')
    return {
      ...item,
      user: userNames.get(accountId) ?? accountName,
      accountRole: item.accountRole ?? item.accountType ?? item.role
        ?? accountRoles.get(accountId) ?? accountRolesByName.get(accountName.toLowerCase()),
    }
  }).sort((a, b) => String((b as Record<string, unknown>).createdAt ?? '')
    .localeCompare(String((a as Record<string, unknown>).createdAt ?? '')))
  const pointsPerKg = { ...pointsPerKgDefaults }
  for (const item of configResult.Items ?? []) {
    const category = String(item.SK).replace('CATEGORY#', '')
    const rate = Number(item.pointsPerKg ?? item.rate)
    if (allowedCategories.has(category) && Number.isFinite(rate) && rate > 0) pointsPerKg[category] = rate
  }
  return json(200, {
    users,
    pickups: (pickupResult.Items ?? []).map(publicPickup),
    rewardTransactions,
    complaints,
    coupons: (couponResult.Items ?? []).map(({ PK: _pk, SK: _sk, ...coupon }) => coupon)
      .sort((a, b) => Number(a.pointsCost) - Number(b.pointsCost)),
    config: { pointsPerKg },
  })
}

const pointsPerKgDefaults = { ...pointsPerKg }

async function updateAdminPointsConfig(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{ pointsPerKg?: Record<string, number> }>(event.body, event.isBase64Encoded)
  if (!input?.pointsPerKg) return json(400, { error: 'pointsPerKg rates are required.' })
  const entries = Object.entries(input.pointsPerKg)
  if (entries.length !== allowedCategories.size || entries.some(([category, rate]) =>
    !allowedCategories.has(category) || !Number.isFinite(Number(rate)) || Number(rate) < 1 || Number(rate) > 10000)) {
    return json(400, { error: 'Provide a positive rate from 1 to 10000 for every supported category.' })
  }
  await Promise.all(entries.map(([category, rate]) => dynamo.send(new UpdateCommand({
    TableName: requireTable(),
    Key: { PK: 'CONFIG#POINTS', SK: `CATEGORY#${category}` },
    UpdateExpression: 'SET pointsPerKg = :rate, updatedAt = :updatedAt',
    ExpressionAttributeValues: { ':rate': Number(rate), ':updatedAt': new Date().toISOString() },
  }))))
  return json(200, { pointsPerKg: input.pointsPerKg })
}

const couponCategories = new Set(['Grocery', 'Shopping', 'Impact', 'Cash', 'Entertainment', 'Food', 'Transport', 'Other'])

function validateCouponInput(input: { title?: string; partner?: string; pointsCost?: number; category?: string; active?: boolean }) {
  if (input.title !== undefined && (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 120)) {
    return 'Coupon title must contain 1 to 120 characters.'
  }
  if (input.partner !== undefined && (typeof input.partner !== 'string' || !input.partner.trim() || input.partner.trim().length > 100)) {
    return 'Partner name must contain 1 to 100 characters.'
  }
  if (input.pointsCost !== undefined && (!Number.isSafeInteger(Number(input.pointsCost)) || Number(input.pointsCost) < 1 || Number(input.pointsCost) > 1000000)) {
    return 'Point cost must be a whole number from 1 to 1,000,000.'
  }
  if (input.category !== undefined && (typeof input.category !== 'string' || !couponCategories.has(input.category.trim()))) {
    return 'Choose a supported coupon category.'
  }
  if (input.active !== undefined && typeof input.active !== 'boolean') return 'Coupon active must be true or false.'
  return null
}

async function createAdminCoupon(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{ title?: string; partner?: string; pointsCost?: number; category?: string }>(event.body, event.isBase64Encoded)
  if (!input) return json(400, { error: 'Coupon details are required.' })
  const error = validateCouponInput(input)
  if (error || !input.title || !input.partner || !input.pointsCost || !input.category) {
    return json(400, { error: error || 'Title, partner, point cost, and category are required.' })
  }
  const now = new Date().toISOString()
  const coupon = {
    id: randomUUID(), title: input.title.trim(), partner: input.partner.trim(),
    pointsCost: Number(input.pointsCost), category: input.category.trim(), active: true,
    createdAt: now, updatedAt: now,
  }
  await dynamo.send(new TransactWriteCommand({
    TransactItems: [{ Put: {
      TableName: requireTable(), Item: { PK: `COUPON#${coupon.id}`, SK: 'META', ...coupon },
      ConditionExpression: 'attribute_not_exists(PK)',
    } }],
  }))
  return json(201, { coupon })
}

async function updateAdminCoupon(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const id = event.pathParameters?.id
  const input = readBody<{ title?: string; partner?: string; pointsCost?: number; category?: string; active?: boolean }>(event.body, event.isBase64Encoded)
  if (!id || !input || !Object.keys(input).length) return json(400, { error: 'Coupon id and at least one field are required.' })
  const error = validateCouponInput(input)
  if (error) return json(400, { error })

  const fields: string[] = []
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() }
  for (const field of ['title', 'partner', 'pointsCost', 'category', 'active'] as const) {
    if (input[field] === undefined) continue
    const token = `#${field}`
    const valueToken = `:${field}`
    names[token] = field
    values[valueToken] = field === 'pointsCost' ? Number(input[field])
      : typeof input[field] === 'string' ? input[field].trim() : input[field]
    fields.push(`${token} = ${valueToken}`)
  }
  fields.push('updatedAt = :updatedAt')
  try {
    const result = await dynamo.send(new UpdateCommand({
      TableName: requireTable(), Key: { PK: `COUPON#${id}`, SK: 'META' },
      UpdateExpression: `SET ${fields.join(', ')}`,
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }))
    const { PK: _pk, SK: _sk, ...coupon } = result.Attributes ?? {}
    return json(200, { coupon })
  } catch (error) {
    if ((error as { name?: string })?.name === 'ConditionalCheckFailedException') return json(404, { error: 'Coupon not found.' })
    throw error
  }
}

async function createComplaint(event: Parameters<APIGatewayProxyHandlerV2>[0], accountId: string) {
  const input = readBody<{ subject?: string; details?: string }>(event.body, event.isBase64Encoded)
  const subject = input?.subject?.trim()
  const details = input?.details?.trim()
  if (!subject || subject.length < 3 || subject.length > 120) {
    return json(400, { error: 'Subject must be between 3 and 120 characters.' })
  }
  if (!details || details.length < 5 || details.length > 2000) {
    return json(400, { error: 'Details must be between 5 and 2,000 characters.' })
  }

  const accountResult = await dynamo.send(new GetCommand({
    TableName: requireTable(), Key: { PK: `ACCOUNT#${accountId}`, SK: 'PROFILE' },
  }))
  const accountRole = String(accountResult.Item?.role
    ?? (hasCognitoGroup(event, 'DeliveryPartners') ? 'delivery' : hasCognitoGroup(event, 'RecyclingCenters') ? 'center' : 'user'))
  const complaint = {
    id: randomUUID(), accountId,
    accountName: String(accountResult.Item?.name ?? (hasCognitoGroup(event, 'DeliveryPartners') ? 'Delivery partner' : hasCognitoGroup(event, 'RecyclingCenters') ? 'Recycling center' : 'Resident')),
    accountRole, subject, details, status: 'open', createdAt: new Date().toISOString(),
  }
  await dynamo.send(new TransactWriteCommand({
    TransactItems: [{ Put: {
      TableName: requireTable(), Item: { PK: `COMPLAINT#${complaint.id}`, SK: 'META', ...complaint },
      ConditionExpression: 'attribute_not_exists(PK)',
    } }],
  }))
  return json(201, { complaint: { ...complaint, user: complaint.accountName } })
}

async function listMyComplaints(accountId: string) {
  const result = await dynamo.send(new ScanCommand({
    TableName: requireTable(),
    FilterExpression: 'begins_with(PK, :complaint) AND SK = :meta AND accountId = :accountId',
    ExpressionAttributeValues: { ':complaint': 'COMPLAINT#', ':meta': 'META', ':accountId': accountId },
  }))
  const items = (result.Items ?? []).map(({ PK: _pk, SK: _sk, ...item }) => ({
    ...item, userId: accountId,
  })).sort((a, b) => String((b as Record<string, unknown>).createdAt ?? '')
    .localeCompare(String((a as Record<string, unknown>).createdAt ?? '')))
  return json(200, { items })
}

async function updateAdminComplaint(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const id = event.pathParameters?.id
  const input = readBody<{ status?: string }>(event.body, event.isBase64Encoded)
  if (!id || !input || !['open', 'resolved'].includes(String(input.status))) {
    return json(400, { error: 'Complaint id and a valid open or resolved status are required.' })
  }
  const resolved = input.status === 'resolved'
  try {
    const result = await dynamo.send(new UpdateCommand({
      TableName: requireTable(), Key: { PK: `COMPLAINT#${id}`, SK: 'META' },
      UpdateExpression: resolved
        ? 'SET #status = :status, resolvedAt = :now, resolvedBy = :admin'
        : 'SET #status = :status REMOVE resolvedAt, resolvedBy',
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: resolved
        ? { ':status': input.status, ':now': new Date().toISOString(), ':admin': authenticatedSubject(event) }
        : { ':status': input.status },
      ReturnValues: 'ALL_NEW',
    }))
    const { PK: _pk, SK: _sk, ...complaint } = result.Attributes ?? {}
    return json(200, { complaint })
  } catch (error) {
    if ((error as { name?: string })?.name === 'ConditionalCheckFailedException') return json(404, { error: 'Complaint not found.' })
    throw error
  }
}

async function deleteMyComplaint(event: Parameters<APIGatewayProxyHandlerV2>[0], accountId: string) {
  const id = event.pathParameters?.id
  if (!id) return json(400, { error: 'Complaint id is required.' })
  try {
    await dynamo.send(new DeleteCommand({
      TableName: requireTable(), Key: { PK: `COMPLAINT#${id}`, SK: 'META' },
      ConditionExpression: 'attribute_exists(PK) AND accountId = :accountId AND #status = :open',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':accountId': accountId, ':open': 'open' },
    }))
    return json(200, { deleted: true, id })
  } catch (error) {
    if ((error as { name?: string })?.name === 'ConditionalCheckFailedException') {
      const existing = await dynamo.send(new GetCommand({
        TableName: requireTable(), Key: { PK: `COMPLAINT#${id}`, SK: 'META' },
      }))
      if (!existing.Item || existing.Item.accountId !== accountId) return json(404, { error: 'Complaint not found.' })
      return json(409, { error: 'Only open complaints can be deleted.' })
    }
    throw error
  }
}

async function syncPartnerGroup(account: Record<string, unknown>, approvalStatus: unknown, status: unknown) {
  if (localAuthEnabled) return
  const group = account.role === 'delivery' ? 'DeliveryPartners'
    : account.role === 'center' ? 'RecyclingCenters' : null
  if (!group) return
  if (!userPoolId || typeof account.email !== 'string' || !account.email) {
    throw new Error('Cognito partner membership cannot be updated without a user pool and account email.')
  }
  const command = approvalStatus === 'approved' && status === 'active'
    ? new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: account.email, GroupName: group })
    : new AdminRemoveUserFromGroupCommand({ UserPoolId: userPoolId, Username: account.email, GroupName: group })
  await cognito.send(command)
}

async function updateAdminAccount(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const id = event.pathParameters?.id
  const input = readBody<{ approvalStatus?: string; status?: string }>(event.body, event.isBase64Encoded)
  if (!id || !input) return json(400, { error: 'Account id and an update are required.' })
  if (input.approvalStatus && !['approved', 'rejected'].includes(input.approvalStatus)) {
    return json(400, { error: 'approvalStatus must be approved or rejected.' })
  }
  if (input.status && !['active', 'suspended'].includes(input.status)) {
    return json(400, { error: 'status must be active or suspended.' })
  }
  if (!input.approvalStatus && !input.status) return json(400, { error: 'approvalStatus or status is required.' })

  const key = { PK: `ACCOUNT#${id}`, SK: 'PROFILE' }
  const accountResult = await dynamo.send(new GetCommand({ TableName: requireTable(), Key: key }))
  const account = accountResult.Item
  if (!account || !['user', 'center', 'delivery'].includes(String(account.role))) {
    return json(404, { error: 'Center or delivery application not found.' })
  }

  const approvalStatus = input.approvalStatus ?? account.approvalStatus
  const status = input.status ?? account.status
  const update = await dynamo.send(new UpdateCommand({
    TableName: requireTable(), Key: key,
    UpdateExpression: 'SET approvalStatus = :approval, #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':approval': approvalStatus, ':status': status, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }))

  if (account.role === 'center' && typeof account.centerId === 'string') {
    const available = approvalStatus === 'approved' && status === 'active'
    await dynamo.send(new UpdateCommand({
      TableName: requireTable(), Key: { PK: `CENTER#${account.centerId}`, SK: 'PROFILE' },
      UpdateExpression: available
        ? 'SET approvalStatus = :approval, available = :available, GSI2PK = :partition, GSI2SK = :sort'
        : 'SET approvalStatus = :approval, available = :available REMOVE GSI2PK, GSI2SK',
      ExpressionAttributeValues: {
        ':approval': approvalStatus,
        ':available': available,
        ...(available ? {
          ':partition': 'AVAILABLE_CENTERS',
          ':sort': `CITY#${String(account.city ?? '')}#CENTER#${account.centerId}`,
        } : {}),
      },
    }))
  }

  await syncPartnerGroup(account, approvalStatus, status)

  return json(200, { account: update.Attributes ? publicAccount(update.Attributes) : undefined })
}

async function createPickup(event: Parameters<APIGatewayProxyHandlerV2>[0], subject: string) {
  const input = readBody<{
    wasteCategory?: string
    quantityKg?: number
    pickupAddress?: string
    scheduledAt?: string
    centerId?: string
    instructions?: string
    residentName?: string
    pickupLatitude?: number
    pickupLongitude?: number
  }>(event.body, event.isBase64Encoded)
  const quantityKg = Number(input?.quantityKg)
  const scheduledAt = input?.scheduledAt ? Date.parse(input.scheduledAt) : NaN

  if (!input?.wasteCategory || !allowedCategories.has(input.wasteCategory)) {
    return json(400, { error: 'A supported wasteCategory is required.' })
  }
  if (!Number.isFinite(quantityKg) || quantityKg <= 0 || quantityKg > 10000) {
    return json(400, { error: 'quantityKg must be greater than 0 and no more than 10000.' })
  }
  if (!input.pickupAddress?.trim() || !input.centerId?.trim()) {
    return json(400, { error: 'pickupAddress and centerId are required.' })
  }
  if (!Number.isFinite(input.pickupLatitude) || input.pickupLatitude! < -90 || input.pickupLatitude! > 90
    || !Number.isFinite(input.pickupLongitude) || input.pickupLongitude! < -180 || input.pickupLongitude! > 180) {
    return json(400, { error: 'A valid pickup map location is required.' })
  }
  if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
    return json(400, { error: 'scheduledAt must be a valid future date.' })
  }

  const centerId = input.centerId.trim()
  const centerResult = await dynamo.send(new GetCommand({
    TableName: requireTable(),
    Key: { PK: `CENTER#${centerId}`, SK: 'PROFILE' },
  }))
  const center = centerResult.Item
  if (!center) return json(404, { error: 'Center not found.' })
  if (center.available !== true) return json(409, { error: 'This center is not currently accepting pickups.' })
  if (!(center.acceptedCategories as string[] | undefined)?.includes(input.wasteCategory)) {
    return json(400, { error: 'This center does not accept the selected waste category.' })
  }

  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const pickup = {
    PK: `PICKUP#${id}`,
    SK: 'META',
    id,
    residentId: subject,
    residentName: input.residentName?.trim().slice(0, 120) || 'Resident',
    wasteCategory: input.wasteCategory,
    quantityKg,
    verifiedWeightKg: null,
    pickupAddress: input.pickupAddress.trim(),
    pickupLatitude: input.pickupLatitude,
    pickupLongitude: input.pickupLongitude,
    scheduledAt: new Date(scheduledAt).toISOString(),
    instructions: input.instructions?.trim() ?? '',
    centerId,
    centerName: center.name,
    deliveryPartnerId: null,
    status: 'Requested',
    pointsAwarded: 0,
    pointsAwardedAt: null,
    createdAt,
    updatedAt: createdAt,
    GSI1PK: `RESIDENT#${subject}`,
    GSI1SK: `PICKUP#${createdAt}#${id}`,
    GSI2PK: 'OPEN_PICKUPS',
    GSI2SK: `${new Date(scheduledAt).toISOString()}#${id}`,
    GSI3PK: `CENTER#${centerId}`,
    GSI3SK: `${new Date(scheduledAt).toISOString()}#${id}`,
  }
  const eventItem = {
    PK: `PICKUP#${id}`,
    SK: `EVENT#${createdAt}#${randomUUID()}`,
    status: 'Requested',
    actorSub: subject,
    note: 'Pickup requested',
    occurredAt: createdAt,
  }

  await dynamo.send(new TransactWriteCommand({
    TransactItems: [
      { Put: { TableName: requireTable(), Item: pickup, ConditionExpression: 'attribute_not_exists(PK)' } },
      { Put: { TableName: requireTable(), Item: eventItem } },
    ],
  }))
  return json(201, { pickup: publicPickup(pickup) })
}

async function getPickup(event: Parameters<APIGatewayProxyHandlerV2>[0], subject: string) {
  const id = event.pathParameters?.id
  if (!id) return json(400, { error: 'Pickup id is required.' })
  const result = await dynamo.send(new GetCommand({
    TableName: requireTable(),
    Key: { PK: `PICKUP#${id}`, SK: 'META' },
  }))
  const item = result.Item
  const isAssignedDeliveryPartner = Boolean(item && hasCognitoGroup(event, 'DeliveryPartners')
    && item.deliveryPartnerId === subject && await isApprovedAccount(subject, 'delivery'))
  const allowed = item && (
    item.residentId === subject ||
    isAssignedDeliveryPartner ||
    (hasCognitoGroup(event, 'RecyclingCenters') && (await getOwnedCenter(subject))?.id === item.centerId)
  )
  if (!allowed || !item) return json(404, { error: 'Pickup not found.' })

  const timeline = await dynamo.send(new QueryCommand({
    TableName: requireTable(),
    KeyConditionExpression: 'PK = :pickup AND begins_with(SK, :event)',
    ExpressionAttributeValues: { ':pickup': `PICKUP#${id}`, ':event': 'EVENT#' },
    ScanIndexForward: true,
  }))
  const pickup = publicPickup(item)
  if (isAssignedDeliveryPartner && typeof item.residentId === 'string') {
    const resident = await dynamo.send(new GetCommand({
      TableName: requireTable(),
      Key: { PK: `ACCOUNT#${item.residentId}`, SK: 'PROFILE' },
      ProjectionExpression: 'phone',
    }))
    pickup.residentPhone = resident.Item?.phone ?? ''
  }
  const events = (timeline.Items ?? []).map(({ PK: _eventPk, SK: _eventSk, ...item }) => ({
    status: item.status,
    at: item.occurredAt,
    note: item.note,
  }))
  return json(200, { pickup: { ...pickup, timeline: events } })
}

async function cancelPickup(event: Parameters<APIGatewayProxyHandlerV2>[0], subject: string) {
  const id = event.pathParameters?.id
  if (!id) return json(400, { error: 'Pickup id is required.' })
  const occurredAt = new Date().toISOString()
  const eventId = randomUUID()

  try {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: requireTable(),
            Key: { PK: `PICKUP#${id}`, SK: 'META' },
            UpdateExpression: 'SET #status = :cancelled, updatedAt = :updatedAt REMOVE GSI2PK, GSI2SK',
            ConditionExpression: 'residentId = :resident AND #status IN (:requested, :accepted, :scheduled)',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':resident': subject,
              ':cancelled': 'Cancelled',
              ':updatedAt': occurredAt,
              ':requested': cancellableStatuses[0],
              ':accepted': cancellableStatuses[1],
              ':scheduled': cancellableStatuses[2],
            },
          },
        },
        {
          Put: {
            TableName: requireTable(),
            Item: {
              PK: `PICKUP#${id}`,
              SK: `EVENT#${occurredAt}#${eventId}`,
              status: 'Cancelled',
              actorSub: subject,
              note: 'Cancelled by resident',
              occurredAt,
            },
          },
        },
      ],
    }))
    return json(200, { status: 'Cancelled' })
  } catch (error) {
    if ((error as { name?: string })?.name === 'TransactionCanceledException') {
      return json(409, { error: 'Pickup not found or it can no longer be cancelled.' })
    }
    throw error
  }
}

async function acceptPickup(event: Parameters<APIGatewayProxyHandlerV2>[0], partnerSub: string) {
  if (!(await isApprovedAccount(partnerSub, 'delivery'))) return json(403, { error: 'This delivery partner application has not been approved.' })
  const id = event.pathParameters?.id
  if (!id) return json(400, { error: 'Pickup id is required.' })
  const [partnerResult, pickupResult] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: requireTable(), Key: { PK: `ACCOUNT#${partnerSub}`, SK: 'PROFILE' } })),
    dynamo.send(new GetCommand({ TableName: requireTable(), Key: { PK: `PICKUP#${id}`, SK: 'META' } })),
  ])
  const partner = partnerResult.Item
  const availablePickup = pickupResult.Item
  const vehicleLimit = vehicleWeightLimitKg[String(partner?.vehicleType ?? '')]
  if (!vehicleLimit) return json(400, { error: 'Select a supported vehicle type in your profile before accepting jobs.' })
  if (!availablePickup) return json(404, { error: 'Pickup not found.' })
  if (Number(availablePickup.quantityKg) > vehicleLimit) {
    return json(409, { error: `This pickup exceeds your vehicle limit of ${vehicleLimit} kg.` })
  }
  const centerResult = typeof availablePickup.centerId === 'string'
    ? await dynamo.send(new GetCommand({ TableName: requireTable(), Key: { PK: `CENTER#${availablePickup.centerId}`, SK: 'PROFILE' } }))
    : undefined
  const hasAllLocations = validCoordinates(partner?.latitude, partner?.longitude)
    && validCoordinates(availablePickup.pickupLatitude, availablePickup.pickupLongitude)
    && validCoordinates(centerResult?.Item?.latitude, centerResult?.Item?.longitude)
  const earningDistanceKm = hasAllLocations
    ? Math.round((haversineKm(
      { latitude: partner.latitude as number, longitude: partner.longitude as number },
      { latitude: availablePickup.pickupLatitude as number, longitude: availablePickup.pickupLongitude as number },
    ) + haversineKm(
      { latitude: availablePickup.pickupLatitude as number, longitude: availablePickup.pickupLongitude as number },
      { latitude: centerResult!.Item!.latitude as number, longitude: centerResult!.Item!.longitude as number },
    )) * 100) / 100
    : null
  const occurredAt = new Date().toISOString()
  const scheduledAt = new Date(Date.parse(occurredAt) + 1).toISOString()
  const scheduledEventId = randomUUID()
  try {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: requireTable(),
            Key: { PK: `PICKUP#${id}`, SK: 'META' },
            UpdateExpression: 'SET #status = :scheduled, deliveryPartnerId = :partner, GSI2PK = :partnerPartition, updatedAt = :updatedAt, vehicleWeightLimitKg = :vehicleLimit, earningDistanceKm = :distance, earningDistanceMethod = :distanceMethod, earningDistanceCapturedAt = :occurredAt',
            ConditionExpression: '#status = :requested AND GSI2PK = :open AND (attribute_not_exists(deliveryPartnerId) OR attribute_type(deliveryPartnerId, :nullType))',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':requested': 'Requested',
              ':scheduled': 'Pickup Scheduled',
              ':partner': partnerSub,
              ':partnerPartition': `PARTNER#${partnerSub}`,
              ':open': 'OPEN_PICKUPS',
              ':nullType': 'NULL',
              ':updatedAt': occurredAt,
              ':occurredAt': occurredAt,
              ':vehicleLimit': vehicleLimit,
              ':distance': earningDistanceKm,
              ':distanceMethod': earningDistanceKm === null ? null : 'straight-line estimate',
            },
          },
        },
        {
          Put: {
            TableName: requireTable(),
            Item: {
              PK: `PICKUP#${id}`, SK: `EVENT#${occurredAt}#${randomUUID()}`,
              status: 'Accepted', actorSub: partnerSub, note: 'Accepted by delivery partner', occurredAt,
            },
          },
        },
        {
          Put: {
            TableName: requireTable(),
            Item: {
              PK: `PICKUP#${id}`, SK: `EVENT#${occurredAt}#${scheduledEventId}`,
              status: 'Pickup Scheduled', actorSub: partnerSub, note: 'Pickup scheduled with resident', occurredAt: scheduledAt,
            },
          },
        },
      ],
    }))
    const result = await dynamo.send(new GetCommand({
      TableName: requireTable(), Key: { PK: `PICKUP#${id}`, SK: 'META' },
    }))
    return json(200, { pickup: result.Item ? publicPickup(result.Item) : undefined })
  } catch (error) {
    if ((error as { name?: string })?.name === 'TransactionCanceledException') {
      return json(409, { error: 'Pickup is no longer available to accept.' })
    }
    throw error
  }
}

async function updatePartnerPickupStatus(event: Parameters<APIGatewayProxyHandlerV2>[0], partnerSub: string) {
  if (!(await isApprovedAccount(partnerSub, 'delivery'))) return json(403, { error: 'This delivery partner application has not been approved.' })
  const id = event.pathParameters?.id
  const input = readBody<{ status?: string }>(event.body, event.isBase64Encoded)
  if (!id || !input?.status) return json(400, { error: 'Pickup id and next status are required.' })
  const transitions: Record<string, { next: string; note: string }> = {
    'Collected': { next: 'Pickup Scheduled', note: 'Waste collected from resident' },
    'Delivered to Center': { next: 'Collected', note: 'Delivered to recycling center' },
  }
  const transition = transitions[input.status]
  if (!transition) return json(400, { error: 'Only Collected or Delivered to Center can be set by a delivery partner.' })

  const occurredAt = new Date().toISOString()
  try {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: requireTable(),
            Key: { PK: `PICKUP#${id}`, SK: 'META' },
            UpdateExpression: `SET #status = :next, updatedAt = :updatedAt, ${input.status === 'Collected' ? 'collectedAt' : 'deliveredAt'} = :occurredAt`,
            ConditionExpression: 'deliveryPartnerId = :partner AND #status = :expected',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':partner': partnerSub, ':expected': transition.next,
              ':next': input.status, ':updatedAt': occurredAt,
              ':occurredAt': occurredAt,
            },
          },
        },
        {
          Put: {
            TableName: requireTable(),
            Item: {
              PK: `PICKUP#${id}`, SK: `EVENT#${occurredAt}#${randomUUID()}`,
              status: input.status, actorSub: partnerSub, note: transition.note, occurredAt,
            },
          },
        },
      ],
    }))
    const result = await dynamo.send(new GetCommand({
      TableName: requireTable(), Key: { PK: `PICKUP#${id}`, SK: 'META' },
    }))
    return json(200, { pickup: result.Item ? publicPickup(result.Item) : undefined })
  } catch (error) {
    if ((error as { name?: string })?.name === 'TransactionCanceledException') {
      return json(409, { error: 'Pickup not found, not assigned to you, or status has changed.' })
    }
    throw error
  }
}

async function verifyPickup(event: Parameters<APIGatewayProxyHandlerV2>[0], centerOwnerSub: string) {
  const id = event.pathParameters?.id
  const input = readBody<{ verifiedWeightKg?: number; note?: string }>(event.body, event.isBase64Encoded)
  const verifiedWeightKg = Number(input?.verifiedWeightKg)
  if (!id || !Number.isFinite(verifiedWeightKg) || verifiedWeightKg <= 0 || verifiedWeightKg > 10000) {
    return json(400, { error: 'Pickup id and verifiedWeightKg greater than 0 and no more than 10000 are required.' })
  }

  const center = await getOwnedCenter(centerOwnerSub)
  if (!center) {
    return json(403, { error: 'This account must be assigned to exactly one recycling center.' })
  }
  if (center.approvalStatus && center.approvalStatus !== 'approved') {
    return json(403, { error: 'This recycling center application has not been approved.' })
  }

  const occurredAt = new Date().toISOString()
  const transactionId = randomUUID()
  const pickupKey = { PK: `PICKUP#${id}`, SK: 'META' }
  const rewardKey = `REWARD#${occurredAt}#${transactionId}`

  try {
    const pickupResult = await dynamo.send(new GetCommand({ TableName: requireTable(), Key: pickupKey }))
    const pickup = pickupResult.Item
    if (!pickup || pickup.centerId !== center.id) return json(404, { error: 'Pickup not found for this center.' })
    let partnerProfile: Record<string, unknown> | undefined
    if (typeof pickup.deliveryPartnerId === 'string') {
      const partnerResult = await dynamo.send(new GetCommand({
        TableName: requireTable(), Key: { PK: `ACCOUNT#${pickup.deliveryPartnerId}`, SK: 'PROFILE' },
      }))
      partnerProfile = partnerResult.Item
      const vehicleLimit = Number(pickup.vehicleWeightLimitKg ?? vehicleWeightLimitKg[String(partnerProfile?.vehicleType ?? '')])
      if (!Number.isFinite(vehicleLimit) || vehicleLimit <= 0) {
        return json(409, { error: 'The assigned delivery partner has no supported vehicle capacity on record.' })
      }
      if (verifiedWeightKg > vehicleLimit) {
        return json(409, { error: `Verified weight exceeds the assigned vehicle limit of ${vehicleLimit} kg.` })
      }
    }
    const hasDistanceLocations = validCoordinates(partnerProfile?.latitude, partnerProfile?.longitude)
      && validCoordinates(pickup.pickupLatitude, pickup.pickupLongitude)
      && validCoordinates(center.latitude, center.longitude)
    const earningDistanceKm = pickup.earningDistanceKm != null
      ? Number(pickup.earningDistanceKm)
      : hasDistanceLocations
        ? Math.round((haversineKm(
          { latitude: partnerProfile!.latitude as number, longitude: partnerProfile!.longitude as number },
          { latitude: pickup.pickupLatitude as number, longitude: pickup.pickupLongitude as number },
        ) + haversineKm(
          { latitude: pickup.pickupLatitude as number, longitude: pickup.pickupLongitude as number },
          { latitude: center.latitude as number, longitude: center.longitude as number },
        )) * 100) / 100
        : null
    const category = String(pickup.wasteCategory)
    const categoryRateResult = await dynamo.send(new GetCommand({
      TableName: requireTable(),
      Key: { PK: 'CONFIG#POINTS', SK: `CATEGORY#${category}` },
    }))
    const categoryRate = Number(categoryRateResult.Item?.pointsPerKg ?? categoryRateResult.Item?.rate ?? pointsPerKg[category])
    if (!categoryRate) return json(400, { error: 'The pickup has an unsupported waste category.' })
    const earnedPoints = Math.round(verifiedWeightKg * categoryRate)
    const note = input?.note?.trim() || 'Recycling verified; reward points credited'

    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: requireTable(),
            Key: pickupKey,
            UpdateExpression: 'SET #status = :verified, verifiedWeightKg = :weight, pointsAwarded = :points, pointsAwardedAt = :occurredAt, updatedAt = :occurredAt, earningDistanceKm = :distance, earningDistanceMethod = :distanceMethod, earningDistanceCapturedAt = :occurredAt',
            ConditionExpression: 'centerId = :center AND #status = :delivered AND pointsAwarded = :zero',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':center': center.id,
              ':delivered': 'Delivered to Center',
              ':zero': 0,
              ':verified': 'Recycling Verified',
              ':weight': verifiedWeightKg,
              ':points': earnedPoints,
              ':occurredAt': occurredAt,
              ':distance': earningDistanceKm,
              ':distanceMethod': earningDistanceKm == null ? null : pickup.earningDistanceMethod ?? 'straight-line estimate',
            },
          },
        },
        {
          Put: {
            TableName: requireTable(),
            Item: {
              PK: pickupKey.PK,
              SK: `EVENT#${occurredAt}#${transactionId}`,
              status: 'Recycling Verified',
              actorSub: centerOwnerSub,
              note,
              occurredAt,
            },
          },
        },
        {
          Put: {
            TableName: requireTable(),
            Item: {
              PK: `ACCOUNT#${pickup.residentId}`,
              SK: rewardKey,
              id: transactionId,
              residentId: pickup.residentId,
              type: 'earn',
              amount: earnedPoints,
              description: `Recycling verified - ${id}`,
              pickupId: id,
              wasteCategory: pickup.wasteCategory,
              verifiedWeightKg,
              createdAt: occurredAt,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        {
          Update: {
            TableName: requireTable(),
            Key: { PK: `ACCOUNT#${pickup.residentId}`, SK: 'POINTS#BALANCE' },
            UpdateExpression: 'SET updatedAt = :occurredAt ADD points :points',
            ExpressionAttributeValues: { ':occurredAt': occurredAt, ':points': earnedPoints },
          },
        },
      ],
    }))

    const [updatedPickup, balanceResult] = await Promise.all([
      dynamo.send(new GetCommand({ TableName: requireTable(), Key: pickupKey })),
      dynamo.send(new GetCommand({
        TableName: requireTable(),
        Key: { PK: `ACCOUNT#${pickup.residentId}`, SK: 'POINTS#BALANCE' },
        ConsistentRead: true,
      })),
    ])
    return json(200, {
      pickup: updatedPickup.Item ? publicPickup(updatedPickup.Item) : undefined,
      reward: { pointsAwarded: earnedPoints, balance: balanceResult.Item?.points ?? earnedPoints },
    })
  } catch (error) {
    if ((error as { name?: string })?.name === 'TransactionCanceledException') {
      return json(409, { error: 'Pickup is not awaiting verification or has already been verified.' })
    }
    throw error
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method
  const path = event.rawPath

  if (method === 'GET' && path === '/health') return json(200, { status: 'ok' })
  if (method === 'GET' && path === '/health/db') {
    try {
      const result = await dynamoClient.send(new DescribeTableCommand({ TableName: requireTable() }))
      const active = result.Table?.TableStatus === 'ACTIVE'
      return json(active ? 200 : 503, {
        status: active ? 'ok' : 'error',
        database: active ? 'connected' : 'unavailable',
      })
    } catch (error) {
      console.error('DynamoDB health check failed:', error)
      return json(503, { status: 'error', database: 'unavailable' })
    }
  }
  if (method === 'POST' && path === '/auth/signup') return signUp(event)
  if (method === 'POST' && path === '/auth/confirm') return confirmSignUp(event)
  if (method === 'POST' && path === '/auth/password/forgot') return requestPasswordReset(event)
  if (method === 'POST' && path === '/auth/password/reset') return confirmPasswordReset(event)
  if (method === 'POST' && path === '/auth/login') return login(event)
  if (method === 'POST' && path === '/auth/refresh') return refreshSession(event)
  if (method === 'GET' && path === '/centers') {
    try {
      return await listCenters(event)
    } catch (error) {
      console.error('Center request failed:', error)
      return json(500, { error: 'Center request failed.' })
    }
  }

  const subject = requireSubject(event)
  if (!subject) return json(401, { error: 'Authentication is required.' })

  try {
    if (path.startsWith('/admin/')) {
      if (!hasCognitoGroup(event, 'PlatformAdmins')) {
        console.warn('Admin authorization denied: PlatformAdmins group check failed.', safeCognitoGroupDiagnostics(event, 'PlatformAdmins'))
        return json(403, { error: 'An active administrator account is required.' })
      }
      if (!(await isApprovedAccount(subject, 'admin'))) {
        console.warn('Admin authorization denied: DynamoDB admin profile check failed.')
        return json(403, { error: 'An active administrator account is required.' })
      }
      if (method === 'GET' && path === '/admin/snapshot') return await getAdminSnapshot()
      if (method === 'POST' && path === '/admin/coupons') return await createAdminCoupon(event)
      if (method === 'PATCH' && path === '/admin/config/points') return await updateAdminPointsConfig(event)
      if (method === 'PATCH' && /^\/admin\/coupons\/[^/]+$/.test(path)) return await updateAdminCoupon(event)
      if (method === 'PATCH' && /^\/admin\/complaints\/[^/]+$/.test(path)) return await updateAdminComplaint(event)
      if (method === 'PATCH' && /^\/admin\/accounts\/[^/]+$/.test(path)) return await updateAdminAccount(event)
      return json(404, { error: 'Not found.' })
    }
    const residentOnlyRoute = (method === 'GET' && (path === '/pickups' || path === '/rewards'))
      || (method === 'POST' && (path === '/pickups' || path === '/rewards/redeem' || path.endsWith('/cancel')))
    if (residentOnlyRoute && !(await isApprovedAccount(subject, 'user'))) {
      return json(403, { error: 'This action is available to active resident accounts only.' })
    }
    if (method === 'GET' && path === '/complaints') return await listMyComplaints(subject)
    if (method === 'POST' && path === '/complaints') return await createComplaint(event, subject)
    if (method === 'DELETE' && /^\/complaints\/[^/]+$/.test(path)) return await deleteMyComplaint(event, subject)
    if (method === 'GET' && path === '/account') return await getAccountProfile(subject)
    if (method === 'PATCH' && path === '/account') return await updateAccountProfile(event, subject)
    if (method === 'GET' && path === '/rewards') return await getRewards(subject, event)
    if (method === 'GET' && path === '/coupons') return await listCoupons()
    if (method === 'POST' && path === '/rewards/redeem') return await redeemCoupon(subject, event)
    if (method === 'GET' && path === '/center/pickups') {
      if (!hasCognitoGroup(event, 'RecyclingCenters')) return json(403, { error: 'An approved recycling center account is required.' })
      return await listCenterPickups(subject)
    }
    if (method === 'POST' && /^\/pickups\/[^/]+\/verify$/.test(path)) {
      if (!hasCognitoGroup(event, 'RecyclingCenters')) {
        return json(403, { error: 'An approved recycling center account is required.' })
      }
      return await verifyPickup(event, subject)
    }
    if (path.startsWith('/pickups/available') || path === '/pickups/mine' || path.endsWith('/accept') || path.endsWith('/status')) {
      if (!hasCognitoGroup(event, 'DeliveryPartners')) {
        return json(403, { error: 'An approved delivery partner account is required.' })
      }
      if (method === 'GET' && path === '/pickups/available') return await listPartnerPickups(subject, true, event)
      if (method === 'GET' && path === '/pickups/mine') return await listPartnerPickups(subject, false, event)
      if (method === 'POST' && path.endsWith('/accept')) return await acceptPickup(event, subject)
      if (method === 'PATCH' && path.endsWith('/status')) return await updatePartnerPickupStatus(event, subject)
    }
    if (method === 'GET' && path === '/pickups') return await listPickups(event, subject)
    if (method === 'POST' && path === '/pickups') return await createPickup(event, subject)
    if (method === 'GET' && path.startsWith('/pickups/')) return await getPickup(event, subject)
    if (method === 'POST' && path.endsWith('/cancel')) return await cancelPickup(event, subject)
    return json(404, { error: 'Not found.' })
  } catch (error) {
    console.error('API request failed:', error)
    return json(500, { error: 'API request failed.' })
  }
}
