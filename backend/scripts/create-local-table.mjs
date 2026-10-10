import {
  CreateTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})
const documentClient = DynamoDBDocumentClient.from(client)

const centers = [
  {
    id: 'center_greenloop', name: 'GreenLoop Recycling Hub', city: 'Bengaluru',
    address: '42 Eco Park Road, Sector 12', acceptedCategories: ['Plastic', 'Paper', 'Glass', 'Metal'],
    operatingHours: 'Mon-Sat 8:00 AM - 8:00 PM', rating: 4.8, available: true,
    description: 'High-throughput dry waste processing with same-day intake.',
  },
  {
    id: 'center_ewaste', name: 'Urban E-Waste Solutions', city: 'Bengaluru',
    address: '18 Tech Lane, Industrial Area', acceptedCategories: ['E-waste', 'Metal', 'Other'],
    operatingHours: 'Mon-Fri 9:00 AM - 6:00 PM', rating: 4.6, available: true,
    description: 'Certified e-waste collection and responsible component recovery.',
  },
  {
    id: 'center_releaf', name: 'ReLeaf Organic Center', city: 'Bengaluru',
    address: '7 Garden Street, North Block', acceptedCategories: ['Organic', 'Paper', 'Other'],
    operatingHours: 'Daily 7:00 AM – 7:00 PM', rating: 4.9, available: true,
    description: 'Community composting and organic waste processing.',
  },
  {
    id: 'center_glass', name: 'CrystalCycle Glass Works', city: 'Bengaluru',
    address: '3 Mill Road, Peenya', acceptedCategories: ['Glass', 'Plastic'],
    operatingHours: 'Tue-Sun 10:00 AM - 7:00 PM', rating: 4.7, available: true,
    description: 'Glass sorting and recycling with a focus on local reuse.',
  },
  {
    id: 'center_sunrise', name: 'Sunrise Scrap Co-op', city: 'Bengaluru',
    address: '9 Industrial Ring Road', acceptedCategories: ['Metal', 'E-waste'],
    operatingHours: '', rating: 0, available: false,
    description: 'New facility awaiting verification.',
  },
]

try {
  await client.send(new CreateTableCommand({
    TableName: 'revive-local',
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
  await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: 'revive-local' })
  console.log('Created DynamoDB Local table revive-local.')
} catch (error) {
  if (error.name === 'ResourceInUseException') {
    await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: 'revive-local' })
    console.log('DynamoDB Local table revive-local already exists.')
  } else {
    throw error
  }
}

for (const center of centers) {
  await documentClient.send(new PutCommand({
    TableName: 'revive-local',
    Item: {
      PK: `CENTER#${center.id}`,
      SK: 'PROFILE',
      ...center,
      ...(center.id === 'center_greenloop' ? {
        GSI1PK: 'OWNER#local-center',
        GSI1SK: 'CENTER#center_greenloop',
      } : {}),
      ...(center.available ? {
        GSI2PK: 'AVAILABLE_CENTERS',
        GSI2SK: `CITY#${center.city}#CENTER#${center.id}`,
      } : {}),
    },
  }))
}
console.log(`Seeded ${centers.length} demo centers and local center ownership into revive-local.`)
documentClient.destroy()
