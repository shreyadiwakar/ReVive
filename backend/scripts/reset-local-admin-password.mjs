import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

async function readText(prompt) {
  const terminal = createInterface({ input: stdin, output: stdout })
  try { return await terminal.question(prompt) } finally { terminal.close() }
}

async function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') return readText(prompt)
  return new Promise((resolve) => {
    stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.resume()
    let value = ''
    const onData = (buffer) => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\u0003') {
          stdin.setRawMode(false)
          stdin.off('data', onData)
          stdout.write('\nCancelled.\n')
          process.exit(130)
        }
        if (character === '\r' || character === '\n') {
          stdin.setRawMode(false)
          stdin.off('data', onData)
          stdout.write('\n')
          resolve(value)
          return
        }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1)
        else if (character >= ' ') value += character
      }
    }
    stdin.on('data', onData)
  })
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, key) => error ? reject(error) : resolve(key.toString('hex')))
  })
}

const email = (await readText('Existing local admin email: ')).trim().toLowerCase()
const password = await readHidden('New admin password (minimum 8 characters): ')
if (!email.includes('@') || password.length < 8) {
  console.error('Enter a valid email and a password with at least 8 characters.')
  process.exit(1)
}

const tableName = process.env.TABLE_NAME ?? 'revive-local'
const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.DDB_ENDPOINT ?? 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})
const dynamo = DynamoDBDocumentClient.from(client)

try {
  const key = await dynamo.send(new GetCommand({
    TableName: tableName,
    Key: { PK: `LOCAL_EMAIL#${email}`, SK: 'UNIQUE' },
  }))
  if (!key.Item?.id) {
    console.error(`No local account exists for ${email} in ${tableName}.`)
    process.exitCode = 1
  } else {
    const account = await dynamo.send(new GetCommand({
      TableName: tableName,
      Key: { PK: `ACCOUNT#${key.Item.id}`, SK: 'PROFILE' },
    }))
    if (account.Item?.role !== 'admin' || account.Item.email !== email) {
      console.error('That email does not belong to a local administrator.')
      process.exitCode = 1
    } else {
      const salt = randomBytes(16).toString('hex')
      const passwordHash = await hashPassword(password, salt)
      await dynamo.send(new UpdateCommand({
        TableName: tableName,
        Key: { PK: `LOCAL_EMAIL#${email}`, SK: 'UNIQUE' },
        UpdateExpression: 'SET passwordSalt = :salt, passwordHash = :hash',
        ConditionExpression: 'id = :id',
        ExpressionAttributeValues: { ':salt': salt, ':hash': passwordHash, ':id': key.Item.id },
      }))
      console.log(`Updated the local admin password for ${email} in DynamoDB Local table ${tableName}.`)
    }
  }
} finally {
  client.destroy()
}
