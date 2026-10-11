import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.TABLE_NAME ?? 'revive-local'
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: process.env.DDB_ENDPOINT ?? 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})
const documentClient = DynamoDBDocumentClient.from(client)
const expectedIndexes = ['GSI1', 'GSI2', 'GSI3']
const expectedCenters = ['center_greenloop', 'center_ewaste', 'center_releaf', 'center_glass', 'center_sunrise']

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

  const centers = await Promise.all(expectedCenters.map(async (id) => {
    const result = await documentClient.send(new GetCommand({
      TableName: tableName,
      Key: { PK: `CENTER#${id}`, SK: 'PROFILE' },
    }))
    return result.Item
  }))
  assert(centers.every(Boolean), 'One or more demo center profiles are missing; run npm run local:db:init.')

  const available = await documentClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :available',
    ExpressionAttributeValues: { ':available': 'AVAILABLE_CENTERS' },
  }))
  assert((available.Items ?? []).length === 4, `Expected 4 available demo centers; found ${available.Items?.length ?? 0}.`)

  const centerOwner = await documentClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :owner AND GSI1SK = :center',
    ExpressionAttributeValues: {
      ':owner': 'OWNER#local-center',
      ':center': 'CENTER#center_greenloop',
    },
  }))
  assert(centerOwner.Items?.length === 1, 'Local center owner mapping is missing; run npm run local:db:init.')

  console.log(JSON.stringify({
    table: tableName,
    status: table.TableStatus,
    primaryKey: table.KeySchema.map((key) => `${key.AttributeName}:${key.KeyType}`),
    indexes: expectedIndexes,
    seededCenters: centers.map((center) => center.id),
    availableCenters: available.Items?.length,
    localCenterOwner: centerOwner.Items[0].id,
    result: 'ok',
  }, null, 2))
} catch (error) {
  console.error(`Local DynamoDB check failed: ${error.message}`)
  process.exitCode = 1
} finally {
  documentClient.destroy()
}
