import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.TABLE_NAME ?? 'revive-local'
const endpoint = process.env.DDB_ENDPOINT ?? 'http://localhost:8000'
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(endpoint)) {
  throw new Error('This cleanup is restricted to a local DynamoDB endpoint.')
}

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})
const documentClient = DynamoDBDocumentClient.from(client)

try {
  const items = []
  let ExclusiveStartKey
  do {
    const result = await documentClient.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }))
    items.push(...(result.Items ?? []))
    ExclusiveStartKey = result.LastEvaluatedKey
  } while (ExclusiveStartKey)

  const testAccounts = items.filter((item) => item.SK === 'PROFILE'
    && typeof item.email === 'string'
    && /^local-smoke-[^@]+@example\.test$/i.test(item.email))
  const accountIds = new Set(testAccounts.map((item) => String(item.id)))
  const centerIds = new Set(testAccounts.map((item) => String(item.centerId ?? '')).filter(Boolean))
  const pickupIds = new Set(items.filter((item) => item.SK === 'META'
    && String(item.PK).startsWith('PICKUP#')
    && (accountIds.has(String(item.residentId))
      || accountIds.has(String(item.deliveryPartnerId))
      || centerIds.has(String(item.centerId))))
    .map((item) => String(item.id)))
  const complaintIds = new Set(items.filter((item) => item.SK === 'META'
    && String(item.PK).startsWith('COMPLAINT#')
    && (accountIds.has(String(item.accountId ?? item.userId ?? item.residentId ?? item.submittedBy))))
    .map((item) => String(item.id)))
  const accountEmails = new Set(testAccounts.map((item) => String(item.email).toLowerCase()))
  const partitions = new Set([
    ...[...accountIds].map((id) => `ACCOUNT#${id}`),
    ...[...centerIds].map((id) => `CENTER#${id}`),
    ...[...pickupIds].map((id) => `PICKUP#${id}`),
    ...[...complaintIds].map((id) => `COMPLAINT#${id}`),
    ...[...accountEmails].map((email) => `LOCAL_EMAIL#${email}`),
  ])
  const deletes = items.filter((item) => partitions.has(String(item.PK)))
    .map((item) => ({ DeleteRequest: { Key: { PK: item.PK, SK: item.SK } } }))

  while (deletes.length) {
    const batch = deletes.splice(0, 25)
    let pending = batch
    for (let attempt = 0; pending.length && attempt < 5; attempt += 1) {
      const result = await documentClient.send(new BatchWriteCommand({
        RequestItems: { [tableName]: pending },
      }))
      pending = result.UnprocessedItems?.[tableName] ?? []
    }
    if (pending.length) throw new Error('Some local smoke-test records could not be removed.')
  }

  console.log(`Removed ${accountIds.size} local smoke-test accounts and their linked records.`)
} finally {
  documentClient.destroy()
}
