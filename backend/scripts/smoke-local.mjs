import { randomUUID } from 'node:crypto'

const baseUrl = process.env.LOCAL_API_URL ?? 'http://127.0.0.1:3001'
const residentId = `local-smoke-${randomUUID()}`
const residentHeaders = { 'x-local-role': 'resident', 'x-local-user': residentId }
const deliveryHeaders = { 'x-local-role': 'delivery' }
const centerHeaders = { 'x-local-role': 'center' }

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

  const pickupResult = await call('/pickups', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      wasteCategory: 'Plastic',
      quantityKg: 2,
      pickupAddress: '1 Local Test Road',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      centerId: 'center_greenloop',
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
