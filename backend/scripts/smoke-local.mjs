import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const baseUrl = process.env.LOCAL_API_URL ?? 'http://127.0.0.1:3001'
const signupHeaders = { 'x-local-role': 'resident' }
let residentHeaders = signupHeaders
const unique = randomUUID()
const smokeAdminId = `local-smoke-admin-${unique}`
const adminHeaders = { 'x-local-role': 'admin', 'x-local-user': smokeAdminId }

async function createTemporaryAdminProfile() {
  const apiHost = new URL(baseUrl).hostname
  if (!['localhost', '127.0.0.1', '::1'].includes(apiHost)) {
    throw new Error('The smoke test only sends requests to a local API.')
  }
  const endpoint = process.env.DDB_ENDPOINT ?? 'http://localhost:8000'
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(endpoint)) {
    throw new Error('The smoke test only creates profiles in local DynamoDB.')
  }
  const email = `${smokeAdminId}@example.test`
  const now = new Date().toISOString()
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'us-east-1', endpoint,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  })
  const documentClient = DynamoDBDocumentClient.from(client)
  try {
    await documentClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME ?? 'revive-local',
      Item: {
        PK: `ACCOUNT#${smokeAdminId}`, SK: 'PROFILE', id: smokeAdminId,
        role: 'admin', email, name: 'Smoke Test Administrator',
        status: 'active', approvalStatus: 'approved', points: 0,
        GSI1PK: `EMAIL#${email}`, GSI1SK: `ACCOUNT#${smokeAdminId}`,
        createdAt: now, updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    }))
  } finally {
    documentClient.destroy()
  }
}

async function call(path, { method = 'GET', roleHeaders = residentHeaders, body, expectedStatus = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...roleHeaders,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`${method} ${path} returned non-JSON (${response.status}): ${text}`)
  }
  if (response.status !== expectedStatus) {
    throw new Error(`${method} ${path}: expected ${expectedStatus}, received ${response.status}: ${data.error ?? text}`)
  }
  return data
}

try {
  await call('/health')
  const database = await call('/health/db')
  if (database.database !== 'connected') throw new Error('DynamoDB health endpoint did not report connected.')
  await createTemporaryAdminProfile()
  await call('/account', { roleHeaders: {}, expectedStatus: 401 })
  await call('/auth/signup', {
    method: 'POST', roleHeaders: signupHeaders, expectedStatus: 400,
    body: {
      role: 'admin', email: `local-smoke-escalation-${unique}@example.test`,
      password: `admin-test-${unique}`, name: 'Untrusted Administrator',
      address: '1 Local Test Road', city: 'Bengaluru', latitude: 12.9750, longitude: 77.6000,
    },
  })

  const centerEmail = `local-smoke-center-${unique}@example.test`
  const centerSignup = await call('/auth/signup', {
    method: 'POST', roleHeaders: signupHeaders, expectedStatus: 201,
    body: {
      role: 'center', email: centerEmail, password: `center-test-${unique}`,
      centerName: `Local Smoke Center ${unique}`, contactPerson: 'Local Smoke Test',
      phone: '+91 90000 12345', address: '1 Local Test Road', city: 'Bengaluru',
      latitude: 12.9716, longitude: 77.5946,
      acceptedCategories: ['Plastic'], operatingHours: 'Daily', description: 'Automated local test center',
    },
  })
  const centerAccount = centerSignup.session
  if (centerAccount?.role !== 'center' || centerAccount.approvalStatus !== 'pending' || !centerAccount.centerId) {
    throw new Error('Center registration did not create a pending center application.')
  }
  await call('/center/pickups', { roleHeaders: { 'x-local-role': 'center', 'x-local-user': centerAccount.id }, expectedStatus: 403 })

  const deliveryEmail = `local-smoke-delivery-${unique}@example.test`
  const deliverySignup = await call('/auth/signup', {
    method: 'POST', roleHeaders: signupHeaders, expectedStatus: 201,
    body: {
      role: 'delivery', email: deliveryEmail, password: `delivery-test-${unique}`,
      name: 'Local Smoke Delivery', phone: '+91 90000 12345', city: 'Bengaluru',
      address: '2 Local Test Road', latitude: 12.9800, longitude: 77.6100,
      serviceArea: 'Bengaluru', vehicleType: 'Bicycle cart', vehicleReg: `SMOKE-${unique.slice(0, 8)}`,
    },
  })
  const deliveryAccount = deliverySignup.session
  if (deliveryAccount?.role !== 'delivery' || deliveryAccount.approvalStatus !== 'pending') {
    throw new Error('Delivery registration did not create a pending application.')
  }
  await call('/pickups/available', { roleHeaders: { 'x-local-role': 'delivery', 'x-local-user': deliveryAccount.id }, expectedStatus: 403 })

  await call('/admin/snapshot', { roleHeaders: signupHeaders, expectedStatus: 403 })
  const pendingSnapshot = await call('/admin/snapshot', { roleHeaders: adminHeaders })
  if (!pendingSnapshot.users?.some((user) => user.id === centerAccount.id && user.approvalStatus === 'pending')) {
    throw new Error('Admin backend did not return the pending center application.')
  }
  await call(`/admin/accounts/${centerAccount.id}`, {
    method: 'PATCH', roleHeaders: adminHeaders, body: { approvalStatus: 'approved' },
  })
  await call(`/admin/accounts/${deliveryAccount.id}`, {
    method: 'PATCH', roleHeaders: adminHeaders, body: { approvalStatus: 'approved' },
  })
  const approvedCenters = await call('/centers')
  if (!approvedCenters.items?.some((center) => center.id === centerAccount.centerId)) {
    throw new Error('Approved center was not published in the center directory.')
  }
  const centerHeaders = { 'x-local-role': 'center', 'x-local-user': centerAccount.id }
  const deliveryHeaders = { 'x-local-role': 'delivery', 'x-local-user': deliveryAccount.id }
  await call('/pickups', { method: 'POST', roleHeaders: deliveryHeaders, body: {}, expectedStatus: 403 })
  await call('/rewards', { roleHeaders: deliveryHeaders, expectedStatus: 403 })
  const centerQueue = await call('/center/pickups', { roleHeaders: centerHeaders })
  if (centerQueue.items?.length) throw new Error('A newly registered center unexpectedly has existing pickups.')

  const email = `local-smoke-${unique}@example.test`
  const password = `local-test-${unique}`
  const registration = await call('/auth/signup', {
    method: 'POST', roleHeaders: signupHeaders, expectedStatus: 201,
    body: {
      email, password, name: 'Local Smoke Resident', phone: '+91 90000 12345',
      address: '1 Local Test Road', city: 'Bengaluru',
      latitude: 12.9750, longitude: 77.6000,
    },
  })
  if (registration.session?.role !== 'user' || registration.session?.email !== email) {
    throw new Error('Local account registration did not return the created resident profile.')
  }
  if ('passwordHash' in registration.session || 'passwordSalt' in registration.session) {
    throw new Error('Local account response exposed password credential fields.')
  }
  const signedIn = await call('/auth/login', {
    method: 'POST', roleHeaders: signupHeaders,
    body: { email, password },
  })
  if (signedIn.session?.id !== registration.session.id) throw new Error('Local account login returned a different account.')
  residentHeaders = { 'x-local-role': 'resident', 'x-local-user': signedIn.session.id }
  const otherResident = await call('/auth/signup', {
    method: 'POST', roleHeaders: signupHeaders, expectedStatus: 201,
    body: {
      email: `local-smoke-other-${unique}@example.test`, password: `other-test-${unique}`,
      name: 'Local Smoke Other Resident', phone: '+91 90000 12345',
      address: '3 Local Test Road', city: 'Bengaluru', latitude: 12.9760, longitude: 77.6010,
    },
  })
  const otherResidentHeaders = { 'x-local-role': 'resident', 'x-local-user': otherResident.session.id }
  await call('/admin/snapshot', { roleHeaders: residentHeaders, expectedStatus: 403 })
  await call('/auth/login', { method: 'POST', roleHeaders: signupHeaders, body: { email, password: 'incorrect-password' }, expectedStatus: 401 })
  await call('/auth/signup', {
    method: 'POST', roleHeaders: signupHeaders, expectedStatus: 409,
    body: {
      email, password, name: 'Duplicate Resident', phone: '+91 90000 12345',
      address: '1 Local Test Road', city: 'Bengaluru', latitude: 12.9750, longitude: 77.6000,
    },
  })
  const account = await call('/account', { roleHeaders: residentHeaders })
  if (account.profile?.address !== '1 Local Test Road') throw new Error('Local account profile was not persisted.')

  const pickupResult = await call('/pickups', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      wasteCategory: 'Plastic',
      quantityKg: 2,
      pickupAddress: account.profile.address,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      centerId: centerAccount.centerId,
      pickupLatitude: 12.9750, pickupLongitude: 77.6000,
      instructions: 'Automated local smoke check',
    },
  })
  const pickupId = pickupResult.pickup?.id
  if (!pickupId) throw new Error('Pickup creation did not return a pickup id.')
  await call(`/pickups/${pickupId}`, { roleHeaders: otherResidentHeaders, expectedStatus: 404 })
  await call(`/pickups/${pickupId}/cancel`, { method: 'POST', roleHeaders: otherResidentHeaders, expectedStatus: 409 })

  const accepted = await call(`/pickups/${pickupId}/accept`, { method: 'POST', roleHeaders: deliveryHeaders })
  if (accepted.pickup?.status !== 'Pickup Scheduled') throw new Error('Pickup claim did not schedule the pickup.')
  const collected = await call(`/pickups/${pickupId}/status`, {
    method: 'PATCH', roleHeaders: deliveryHeaders, body: { status: 'Collected' },
  })
  if (collected.pickup?.status !== 'Collected') throw new Error('Pickup did not move to Collected.')
  const delivered = await call(`/pickups/${pickupId}/status`, {
    method: 'PATCH', roleHeaders: deliveryHeaders, body: { status: 'Delivered to Center' },
  })
  if (delivered.pickup?.status !== 'Delivered to Center') throw new Error('Pickup did not move to Delivered to Center.')

  const deliveredQueue = await call('/center/pickups', { roleHeaders: centerHeaders })
  if (!deliveredQueue.items?.some((pickup) => pickup.id === pickupId && pickup.status === 'Delivered to Center')) {
    throw new Error('Delivered pickup was not visible in its assigned center queue.')
  }

  const verified = await call(`/pickups/${pickupId}/verify`, {
    method: 'POST', roleHeaders: centerHeaders, body: { verifiedWeightKg: 1.7, note: 'Automated local smoke check' },
  })
  if (verified.pickup?.status !== 'Recycling Verified') throw new Error('Pickup was not marked Recycling Verified.')
  if (verified.reward?.pointsAwarded !== 34) throw new Error(`Expected 34 points for 1.7 kg of Plastic, received ${verified.reward?.pointsAwarded}.`)

  const rewards = await call('/rewards', { roleHeaders: residentHeaders })
  if (rewards.balance !== 34 || rewards.transactions?.length !== 1) {
    throw new Error(`Expected one 34-point ledger entry, received balance ${rewards.balance} and ${rewards.transactions?.length ?? 0} entries.`)
  }
  await call(`/pickups/${pickupId}/verify`, {
    method: 'POST', roleHeaders: centerHeaders, body: { verifiedWeightKg: 1.7 }, expectedStatus: 409,
  })
  const afterRetry = await call('/rewards', { roleHeaders: residentHeaders })
  if (afterRetry.balance !== 34 || afterRetry.transactions?.length !== 1) {
    throw new Error('A duplicate verification changed the reward balance or ledger.')
  }

  console.log(JSON.stringify({
    result: 'passed',
    centerAccountId: centerAccount.id,
    deliveryAccountId: deliveryAccount.id,
    accountId: signedIn.session.id,
    pickupId,
    statuses: ['Pickup Scheduled', 'Collected', 'Delivered to Center', 'Recycling Verified'],
    pointsAwarded: verified.reward.pointsAwarded,
    balanceAfterDuplicateAttempt: afterRetry.balance,
    ledgerEntries: afterRetry.transactions.length,
    duplicateVerification: '409; no duplicate award',
    authorizationChecks: [
      'unauthenticated account request: 401',
      'self-service admin role: 400',
      'unapproved delivery and center access: 403',
      'delivery access to resident pickup and rewards routes: 403',
      'resident access to admin route: 403',
      'cross-account pickup read/cancel: 404/409',
    ],
  }, null, 2))
} catch (error) {
  console.error(`Local pickup-to-reward smoke check failed: ${error.message}`)
  process.exitCode = 1
} finally {
  const cleanup = spawnSync(process.execPath, [fileURLToPath(new URL('./cleanup-local-smoke-data.mjs', import.meta.url))], {
    env: { ...process.env, LOCAL_SMOKE_RUN_ID: unique },
    stdio: 'inherit',
  })
  if (cleanup.status !== 0) {
    console.error('Could not remove local smoke-test records.')
    process.exitCode = 1
  }
}
