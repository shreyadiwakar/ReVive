import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'

async function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    const terminal = createInterface({ input: stdin, output: stdout })
    try { return await terminal.question(prompt) } finally { terminal.close() }
  }
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
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
          continue
        }
        if (character >= ' ') value += character
      }
    }
    stdin.on('data', onData)
  })
}

async function readText(prompt) {
  const terminal = createInterface({ input: stdin, output: stdout })
  try { return await terminal.question(prompt) } finally { terminal.close() }
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, key) => error ? reject(error) : resolve(key.toString('hex')))
  })
}

const email = (await readText('Admin email: ')).trim().toLowerCase()
const password = await readHidden('Admin password (minimum 8 characters): ')
if (!email.includes('@') || password.length < 8) {
  console.error('Enter a valid email and a password with at least 8 characters.')
  process.exit(1)
}
const name = (await readText('Admin display name: ')).trim()
if (!name) {
  console.error('Admin display name is required.')
  process.exit(1)
}

const id = randomUUID()
const salt = randomBytes(16).toString('hex')
const passwordHash = await hashPassword(password, salt)
const createdAt = new Date().toISOString()
const tableName = process.env.TABLE_NAME ?? 'revive-local'
const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.DDB_ENDPOINT ?? 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})
const dynamo = DynamoDBDocumentClient.from(client)

try {
  await dynamo.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: tableName,
          Item: {
            PK: `ACCOUNT#${id}`, SK: 'PROFILE', id, role: 'admin', email, name,
            status: 'active', approvalStatus: 'approved', points: 0, createdAt, updatedAt: createdAt,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: { PK: `LOCAL_EMAIL#${email}`, SK: 'UNIQUE', id, passwordSalt: salt, passwordHash },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ],
  }))
  console.log(`Created local administrator ${email} in DynamoDB Local table ${tableName}.`)
} catch (error) {
  if (error?.name === 'TransactionCanceledException') {
    console.error(`An account with that email already exists, or ${tableName} is not initialized.`)
    process.exitCode = 1
  } else {
    throw error
  }
} finally {
  dynamo.destroy()
}
