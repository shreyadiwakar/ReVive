import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.TABLE_NAME ?? 'revive-local'
const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.DDB_ENDPOINT ?? 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})
const dynamo = DynamoDBDocumentClient.from(client)

try {
  let lastKey
  let repaired = 0
  do {
    const page = await dynamo.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'begins_with(PK, :pickup) AND SK = :meta AND #status = :verified AND attribute_exists(deliveryPartnerId) AND attribute_not_exists(GSI2PK)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pickup': 'PICKUP#', ':meta': 'META', ':verified': 'Recycling Verified',
      },
      ExclusiveStartKey: lastKey,
    }))

    for (const item of page.Items ?? []) {
      if (!item.id || !item.deliveryPartnerId || !item.scheduledAt) continue
      await dynamo.send(new UpdateCommand({
        TableName: tableName,
        Key: { PK: item.PK, SK: 'META' },
        UpdateExpression: 'SET GSI2PK = :partner, GSI2SK = :sort',
        ConditionExpression: 'attribute_not_exists(GSI2PK) AND deliveryPartnerId = :deliveryPartner',
        ExpressionAttributeValues: {
          ':partner': `PARTNER#${item.deliveryPartnerId}`,
          ':sort': `${new Date(item.scheduledAt).toISOString()}#${item.id}`,
          ':deliveryPartner': item.deliveryPartnerId,
        },
      }))
      repaired += 1
    }
    lastKey = page.LastEvaluatedKey
  } while (lastKey)

  console.log(`Restored ${repaired} verified delivery record(s) in DynamoDB Local table ${tableName}.`)
} catch (error) {
  console.error(`Could not repair delivery history in ${tableName} at ${process.env.DDB_ENDPOINT ?? 'http://localhost:8000'}. Is DynamoDB Local running?`)
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  client.destroy()
}
