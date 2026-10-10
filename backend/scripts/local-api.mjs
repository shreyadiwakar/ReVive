import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

process.env.AWS_REGION = 'us-east-1'
process.env.AWS_ACCESS_KEY_ID = 'local'
process.env.AWS_SECRET_ACCESS_KEY = 'local'
process.env.DDB_ENDPOINT = 'http://localhost:8000'
process.env.TABLE_NAME = 'revive-local'

const { handler } = await import('../dist/handler.js')
const groupsByRole = {
  resident: [],
  delivery: ['DeliveryPartners'],
  center: ['RecyclingCenters'],
}
const corsOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])

function respond(response, statusCode, headers, body) {
  response.writeHead(statusCode, headers)
  response.end(body ?? '')
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin
  const corsHeaders = corsOrigins.has(origin)
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-headers': 'content-type, x-local-role, x-local-user',
        'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
      }
    : {}
  if (request.method === 'OPTIONS') {
    respond(response, 204, corsHeaders)
    return
  }

  const url = new URL(request.url ?? '/', 'http://localhost:3000')
  const role = String(request.headers['x-local-role'] ?? 'resident').toLowerCase()
  if (!Object.hasOwn(groupsByRole, role)) {
    respond(response, 400, { ...corsHeaders, 'content-type': 'application/json' }, JSON.stringify({ error: 'x-local-role must be resident, delivery, or center.' }))
    return
  }
  const defaultUser = role === 'delivery' ? 'local-delivery' : role === 'center' ? 'local-center' : 'local-resident'
  const subject = String(request.headers['x-local-user'] ?? defaultUser).trim()
  if (!subject || subject.length > 128) {
    respond(response, 400, { ...corsHeaders, 'content-type': 'application/json' }, JSON.stringify({ error: 'x-local-user must be between 1 and 128 characters.' }))
    return
  }

  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) {
      respond(response, 413, { ...corsHeaders, 'content-type': 'application/json' }, JSON.stringify({ error: 'Request body is too large.' }))
      return
    }
  }

  const pickupMatch = url.pathname.match(/^\/pickups\/([^/]+)(?:\/|$)/)
  const event = {
    version: '2.0',
    routeKey: `${request.method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers: request.headers,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    pathParameters: pickupMatch ? { id: decodeURIComponent(pickupMatch[1]) } : undefined,
    body: body || undefined,
    isBase64Encoded: false,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: request.method,
        path: url.pathname,
        protocol: `HTTP/${request.httpVersion}`,
        sourceIp: request.socket.remoteAddress ?? '127.0.0.1',
        userAgent: String(request.headers['user-agent'] ?? 'local-test-client'),
      },
      requestId: randomUUID(),
      routeKey: `${request.method} ${url.pathname}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      authorizer: {
        jwt: {
          claims: {
            sub: subject,
            'cognito:groups': groupsByRole[role],
            token_use: 'access',
          },
        },
      },
    },
  }

  try {
    const result = await handler(event)
    respond(response, result.statusCode ?? 200, { ...corsHeaders, ...result.headers }, result.body)
  } catch (error) {
    console.error('Local API request failed:', error)
    respond(response, 500, { ...corsHeaders, 'content-type': 'application/json' }, JSON.stringify({ error: 'Local API request failed.' }))
  }
})

const port = Number(process.env.PORT ?? 3001)
server.listen(port, '127.0.0.1', () => {
  console.log(`Local API listening at http://127.0.0.1:${port}`)
  console.log('Test identities: x-local-role resident (local-resident), delivery (local-delivery), center (local-center).')
  console.log('This local server bypasses Cognito and must not be used outside local development.')
})
