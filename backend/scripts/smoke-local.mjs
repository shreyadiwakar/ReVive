import { randomUUID } from 'node:crypto'

const baseUrl = process.env.LOCAL_API_URL ?? 'http://127.0.0.1:3001'
const signupHeaders = { 'x-local-role': 'resident' }
let residentHeaders = signupHeaders
const adminHeaders = { 'x-local-role': 'admin' }

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
  const directory = await call('/centers')
  if (!directory.items?.some((center) => center.id === 'center_greenloop')) {
    throw new Error('GreenLoop is missing from the seeded center directory; run npm run local:db:init.')
  }

  const unique = randomUUID()
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

  const deliveryEmail = `local-smoke-delivery-${unique}@example.test`
  const deliverySignup = await call('/auth/signup', {
    method: 'POST', roleHeaders: signupHeaders, expectedStatus: 201,
    body: {
      role: 'delivery', email: deliveryEmail, password: `delivery-test-${unique}`,
      name: 'Local Smoke Delivery', phone: '+91 90000 12345', city: 'Bengaluru',
      address: '2 Local Test Road', latitude: 12.9800, longitude: 77.6100,
      serviceArea: 'Bengaluru', vehicleType: 'Bicycle', vehicleReg: `SMOKE-${unique.slice(0, 8)}`,
    },
  })
  const deliveryAccount = deliverySignup.session
  if (deliveryAccount?.role !== 'delivery' || deliveryAccount.approvalStatus !== 'pending') {
    throw new Error('Delivery registration did not create a pending application.')
  }
  await call('/pickups/available', { roleHeaders: { 'x-local-role': 'delivery', 'x-local-user': deliveryAccount.id }, expectedStatus: 403 })

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
  await call('/auth/login', { method: 'POST', roleHeaders: signupHeaders, body: { email, password: 'incorrect-password' }, expectedStatus: 401 })
  await call('/auth/signup', {
    method: 'POST', roleHeaders: signupHeaders, expectedStatus: 409,
    body: { email, password, name: 'Duplicate Resident' },
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
  }, null, 2))
} catch (error) {
  console.error(`Local pickup-to-reward smoke check failed: ${error.message}`)
  process.exitCode = 1
}
