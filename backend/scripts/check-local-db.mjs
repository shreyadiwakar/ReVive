import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'

const tableName = process.env.TABLE_NAME ?? 'revive-local'
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: process.env.DDB_ENDPOINT ?? 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})
const expectedIndexes = ['GSI1', 'GSI2', 'GSI3']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const description = await client.send(new DescribeTableCommand({ TableName: tableName }))
  const table = description.Table
  assert(table?.TableStatus === 'ACTIVE', `${tableName} must be ACTIVE.`)
  assert(table.KeySchema?.some((key) => key.AttributeName === 'PK' && key.KeyType === 'HASH'), 'PK HASH key is missing.')
  assert(table.KeySchema?.some((key) => key.AttributeName === 'SK' && key.KeyType === 'RANGE'), 'SK RANGE key is missing.')
  const actualIndexes = (table.GlobalSecondaryIndexes ?? []).map((index) => index.IndexName).sort()
  assert(expectedIndexes.every((name) => actualIndexes.includes(name)), `Expected GSI1, GSI2, and GSI3; found ${actualIndexes.join(', ')}.`)
  for (const index of table.GlobalSecondaryIndexes ?? []) {
    assert(index.IndexStatus === 'ACTIVE', `${index.IndexName} must be ACTIVE.`)
  }

  console.log(JSON.stringify({
    table: tableName,
    status: table.TableStatus,
    primaryKey: table.KeySchema.map((key) => `${key.AttributeName}:${key.KeyType}`),
    indexes: expectedIndexes,
    result: 'ok',
  }, null, 2))
} catch (error) {
  console.error(`Local DynamoDB check failed: ${error.message}`)
  process.exitCode = 1
} finally {
  client.destroy()
}
