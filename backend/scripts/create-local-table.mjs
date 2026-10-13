import {
  CreateTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'
import { DeleteCommand, DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.TABLE_NAME ?? 'revive-local'
const endpoint = process.env.DDB_ENDPOINT ?? 'http://localhost:8000'
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})
const documentClient = DynamoDBDocumentClient.from(client)

try {
  await client.send(new CreateTableCommand({
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
      { AttributeName: 'GSI2PK', AttributeType: 'S' },
      { AttributeName: 'GSI2SK', AttributeType: 'S' },
      { AttributeName: 'GSI3PK', AttributeType: 'S' },
      { AttributeName: 'GSI3SK', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GSI2',
        KeySchema: [
          { AttributeName: 'GSI2PK', KeyType: 'HASH' },
          { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'GSI3',
        KeySchema: [
          { AttributeName: 'GSI3PK', KeyType: 'HASH' },
          { AttributeName: 'GSI3SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  }))
  await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: tableName })
  console.log(`Created DynamoDB Local table ${tableName}.`)
} catch (error) {
  if (error.name === 'ResourceInUseException') {
    await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: tableName })
    console.log(`DynamoDB Local table ${tableName} already exists.`)
  } else {
    throw error
  }
}

const oldCenterIds = ['center_greenloop', 'center_ewaste', 'center_releaf', 'center_glass', 'center_sunrise']
const oldCouponIds = ['coupon_grocery', 'coupon_amazon', 'coupon_tree', 'coupon_cash', 'coupon_movie']
for (const id of oldCenterIds) {
  const key = { PK: `CENTER#${id}`, SK: 'PROFILE' }
  const result = await documentClient.send(new GetCommand({ TableName: tableName, Key: key }))
  const existingCenter = result.Item
  if (existingCenter && (!existingCenter.ownerId || existingCenter.ownerId === 'local-center')) {
    await documentClient.send(new DeleteCommand({ TableName: tableName, Key: key }))
  }
}
for (const id of oldCouponIds) {
  await documentClient.send(new DeleteCommand({ TableName: tableName, Key: { PK: `COUPON#${id}`, SK: 'META' } }))
}
console.log('Removed legacy sample centers and coupons; existing owned centers were preserved.')
documentClient.destroy()
