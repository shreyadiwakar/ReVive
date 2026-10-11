import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.TABLE_NAME ?? 'revive-local'
const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.DDB_ENDPOINT ?? 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})
const documentClient = DynamoDBDocumentClient.from(client)

try {
  const result = await documentClient.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: 'begins_with(PK, :accountPrefix) AND SK = :profile',
    ExpressionAttributeValues: {
      ':accountPrefix': 'ACCOUNT#',
      ':profile': 'PROFILE',
    },
    ProjectionExpression: 'id, email, #accountName, phone, address, city, createdAt, points',
    ExpressionAttributeNames: { '#accountName': 'name' },
  }))
  const users = (result.Items ?? []).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
  console.log(JSON.stringify({ table: tableName, count: users.length, users }, null, 2))
} catch (error) {
  console.error(`Could not read ${tableName} at ${process.env.DDB_ENDPOINT ?? 'http://localhost:8000'}. Is DynamoDB Local running?`)
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  client.destroy()
}
