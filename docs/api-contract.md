# ReVive API contract (first backend slice)

Base URL is the API Gateway URL from the SAM stack output. JSON request and
response bodies use `application/json`. Authenticated requests send
`Authorization: Bearer <accessToken>`.

## Authentication

| Method and path | Request | Success |
|---|---|---|
| `POST /auth/signup` | `{ "email", "password", "name" }` | `201 { "status": "confirmation_required", "userId", "email" }` |
| `POST /auth/confirm` | `{ "email", "code" }` | `200 { "status": "confirmed" }` |
| `POST /auth/login` | `{ "email", "password" }` | `200 { "accessToken", "idToken", "refreshToken", "expiresIn", "tokenType" }` |

Signup currently creates resident accounts only. Cognito sends the email
confirmation code. The API Gateway JWT authorizer protects pickup routes.
The standalone local runner uses a local-only sign-up/login implementation
backed by DynamoDB Local; local passwords are salted and hashed, and email
confirmation is skipped. It does not call Cognito.

The standalone local runner also exposes these local-only resident profile
endpoints; they are not included in the deployed API template:

| Method and path | Request | Success |
|---|---|---|
| `GET /account` | â€” | `200 { "profile": {...} }` |
| `PATCH /account` | `{ "name", "phone", "address", "city" }` | `200 { "profile": {...} }` |

## Centers

The center directory is public and returns available centers. `city` and
`category` are optional exact-match filters.

| Method and path | Request | Success |
|---|---|---|
| `GET /centers?city=Bengaluru&category=Plastic&limit=25` | — | `200 { "items": [...] }` |

Each center includes `id`, `name`, `city`, `address`, `acceptedCategories`,
`operatingHours`, `rating`, `available`, and `description`. The directory shows
centers that have registered and been approved.

## Pickups

All pickup routes require a Cognito access token.

| Method and path | Request | Success |
|---|---|---|
| `GET /pickups?limit=25` | — | `200 { "items": [...] }` |
| `POST /pickups` | `{ "wasteCategory", "quantityKg", "pickupAddress", "scheduledAt", "centerId", "instructions?" }` | `201 { "pickup": {...} }` |
| `GET /pickups/{id}` | — | `200 { "pickup": {..., "timeline": [...] } }` |
| `POST /pickups/{id}/cancel` | — | `200 { "status": "Cancelled" }` |
| `GET /pickups/available?limit=25` | — | `200 { "items": [...] }` |
| `GET /pickups/mine?limit=25` | — | `200 { "items": [...] }` |
| `POST /pickups/{id}/accept` | — | `200 { "pickup": {...} }` |
| `PATCH /pickups/{id}/status` | `{ "status": "Collected" }` or `{ "status": "Delivered to Center" }` | `200 { "pickup": {...} }` |
| `POST /pickups/{id}/verify` | `{ "verifiedWeightKg": 5.6, "note?": "Received in good condition" }` | `200 { "pickup": {...}, "reward": { "pointsAwarded", "balance" } }` |
| `GET /rewards?limit=25` | — | `200 { "balance": 112, "transactions": [...] }` |

`scheduledAt` must be a future ISO 8601 date. `wasteCategory` is one of
Plastic, Paper, Glass, Metal, E-waste, Organic, or Other. Quantity must be
greater than 0 and at most 10,000 kg. Pickup creation and cancellation write
the state and timeline event transactionally. A resident can only read or
cancel their own pickups. Cancellation is allowed only while Requested,
Accepted, or Pickup Scheduled. Creating a pickup requires an existing, available
center that accepts the requested waste category; the center name is copied to
the pickup record.

Delivery routes additionally require the `DeliveryPartners` Cognito group. An
administrator must add approved delivery accounts to that group. Partners can
claim a Requested job once; claiming moves it to Pickup Scheduled and records
both Accepted and Pickup Scheduled timeline entries. The assigned partner can
then move it through Collected and Delivered to Center. Each state change and
its timeline event are committed transactionally. Recycling verification is
restricted to `RecyclingCenters` members whose Cognito subject is mapped to the
pickup's center profile. Center profiles use GSI1 keys `OWNER#<subject>` /
`CENTER#<centerId>` for this mapping; provision an owner mapping when approving
a center operator. Verification requires a Delivered to Center pickup and a
positive received weight up to 10,000 kg. It changes the pickup to Recycling
Verified and writes the timeline event, reward ledger entry, and balance update
in one transaction. Points use the frontend's rates (Plastic 20, Paper 15,
Glass 18, Metal 25, E-waste 30, Organic 10, Other 12 per kg) and are rounded
to the nearest integer. The status condition prevents duplicate rewards.

Common errors: `400` invalid input, `401` missing/invalid authentication,
`403` caller lacks the required partner group or center assignment, `404` pickup not found, `409`
duplicate email, stale job claim, or invalid status transition, and `500`
unexpected failure.

Reward redemption and coupon management are future API work.

For local runs, DynamoDB Local supports the pickup table. Cognito itself is not
emulated by DynamoDB Local; signup, confirmation, and login need a configured
Cognito user pool. The repository has not been deployed to AWS.
