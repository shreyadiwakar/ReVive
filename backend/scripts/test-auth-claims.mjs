import assert from 'node:assert/strict'
import { hasCognitoGroup, hasCognitoGroupClaim } from '../dist/handler.js'

assert.equal(hasCognitoGroupClaim(['PlatformAdmins'], 'PlatformAdmins'), true)
assert.equal(hasCognitoGroupClaim('["PlatformAdmins"]', 'PlatformAdmins'), true)
assert.equal(hasCognitoGroupClaim('["RecyclingCenters","PlatformAdmins"]', 'PlatformAdmins'), true)
assert.equal(hasCognitoGroupClaim('RecyclingCenters, PlatformAdmins', 'PlatformAdmins'), true)
assert.equal(hasCognitoGroupClaim('"PlatformAdmins"', 'PlatformAdmins'), true)
assert.equal(hasCognitoGroupClaim("['PlatformAdmins']", 'PlatformAdmins'), true)
assert.equal(hasCognitoGroupClaim('["PlatformAdmins"]', 'PlatformAdmin'), false)
assert.equal(hasCognitoGroupClaim('Residents, DeliveryPartners', 'PlatformAdmins'), false)
assert.equal(hasCognitoGroupClaim(undefined, 'PlatformAdmins'), false)

const event = {
  version: '2.0',
  routeKey: 'GET /admin/snapshot',
  rawPath: '/admin/snapshot',
  requestContext: {
    http: { method: 'GET', path: '/admin/snapshot', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test-client' },
    authorizer: {
      jwt: {
        claims: {
          sub: 'user-123',
          'cognito:groups': '"PlatformAdmins"',
        },
      },
    },
  },
}

assert.equal(hasCognitoGroup(event, 'PlatformAdmins'), true)
assert.equal(hasCognitoGroup({ ...event, requestContext: { ...event.requestContext, authorizer: { jwt: { claims: { 'cognito:groups': '"PlatformAdmins"' } } } } }, 'PlatformAdmins'), true)
assert.equal(hasCognitoGroup({ ...event, requestContext: { ...event.requestContext, authorizer: { jwt: { claims: { 'cognito:groups': "['PlatformAdmins']" } } } } }, 'PlatformAdmins'), true)

console.log('Cognito group claim tests passed.')
