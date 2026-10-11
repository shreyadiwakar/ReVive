import { DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.DDB_ENDPOINT ?? 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

try {
  await client.send(new DeleteTableCommand({ TableName: 'revive-local-test' }))
  console.log('Deleted isolated DynamoDB Local test table revive-local-test.')
} catch (error) {
  if (error?.name === 'ResourceNotFoundException') console.log('Isolated test table revive-local-test does not exist.')
  else throw error
} finally {
  client.destroy()
}
