import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'
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

const allowedCategories = new Set([
  'Plastic', 'Paper', 'Glass', 'Metal', 'E-waste', 'Organic', 'Other',
])
const pointsPerKg: Record<string, number> = {
  Plastic: 20, Paper: 15, Glass: 18, Metal: 25, 'E-waste': 30, Organic: 10, Other: 12,
}
const cancellableStatuses = ['Requested', 'Accepted', 'Pickup Scheduled']

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

function hasCognitoGroup(event: APIGatewayProxyEventV2, group: string) {
  const context = event.requestContext as APIGatewayProxyEventV2WithJWTAuthorizer['requestContext']
  const groups = context.authorizer?.jwt?.claims['cognito:groups']
  return Array.isArray(groups) ? groups.includes(group) : typeof groups === 'string' && groups.split(',').includes(group)
}

async function signUp(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const input = readBody<{ email?: string; password?: string; name?: string }>(event.body, event.isBase64Encoded)
  const email = input?.email?.trim().toLowerCase()
  const password = input?.password
  const name = input?.name?.trim()
  if (!email || !password || !name || !email.includes('@')) {
    return json(400, { error: 'Email, password, and name are required.' })
  }
  if (!clientId) return json(500, { error: 'Identity provider is not configured.' })

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
    return json(201, {
      status: result.UserConfirmed ? 'confirmed' : 'confirmation_required',
      userId: result.UserSub,
      email,
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

async function login(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
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
    return json(200, {
      accessToken: result.AuthenticationResult.AccessToken,
      idToken: result.AuthenticationResult.IdToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
      expiresIn: result.AuthenticationResult.ExpiresIn,
      tokenType: result.AuthenticationResult.TokenType,
    })
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
  const limitValue = Number(event.queryStringParameters?.limit ?? 25)
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 50) : 25
  const result = await dynamo.send(new QueryCommand({
    TableName: requireTable(),
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :partition',
    ExpressionAttributeValues: {
      ':partition': available ? 'OPEN_PICKUPS' : `PARTNER#${subject}`,
    },
    Limit: limit,
    ScanIndexForward: true,
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
  const items = (result.Items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    city: item.city,
    address: item.address,
    acceptedCategories: item.acceptedCategories,
    operatingHours: item.operatingHours,
    rating: item.rating,
    available: item.available,
    description: item.description,
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
  return centers.Items[0]
}

async function listCenterPickups(ownerSub: string) {
  const center = await getOwnedCenter(ownerSub)
  if (!center) return json(403, { error: 'This account must be assigned to exactly one recycling center.' })
  const result = await dynamo.send(new QueryCommand({
    TableName: requireTable(), IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3PK = :center',
    ExpressionAttributeValues: { ':center': `CENTER#${center.id}` },
    ScanIndexForward: true,
  }))
  return json(200, { items: (result.Items ?? []).map(publicPickup) })
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
  const allowed = item && (
    item.residentId === subject ||
    (hasCognitoGroup(event, 'DeliveryPartners') && item.deliveryPartnerId === subject) ||
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
  const id = event.pathParameters?.id
  if (!id) return json(400, { error: 'Pickup id is required.' })
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
            UpdateExpression: 'SET #status = :scheduled, deliveryPartnerId = :partner, GSI2PK = :partnerPartition, updatedAt = :updatedAt',
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
            UpdateExpression: 'SET #status = :next, updatedAt = :updatedAt',
            ConditionExpression: 'deliveryPartnerId = :partner AND #status = :expected',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':partner': partnerSub, ':expected': transition.next,
              ':next': input.status, ':updatedAt': occurredAt,
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

  const occurredAt = new Date().toISOString()
  const transactionId = randomUUID()
  const pickupKey = { PK: `PICKUP#${id}`, SK: 'META' }
  const rewardKey = `REWARD#${occurredAt}#${transactionId}`

  try {
    const pickupResult = await dynamo.send(new GetCommand({ TableName: requireTable(), Key: pickupKey }))
    const pickup = pickupResult.Item
    if (!pickup || pickup.centerId !== center.id) return json(404, { error: 'Pickup not found for this center.' })
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
            UpdateExpression: 'SET #status = :verified, verifiedWeightKg = :weight, pointsAwarded = :points, pointsAwardedAt = :occurredAt, updatedAt = :occurredAt REMOVE GSI2PK, GSI2SK',
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
  if (method === 'POST' && path === '/auth/login') return login(event)
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
    if (method === 'GET' && path === '/rewards') return await getRewards(subject, event)
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
    console.error('Pickup request failed:', error)
    return json(500, { error: 'Pickup request failed.' })
  }
}
