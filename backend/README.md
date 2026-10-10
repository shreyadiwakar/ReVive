# ReVive serverless backend starter

The backend is TypeScript on AWS Lambda, exposed through API Gateway and backed
by DynamoDB. Cognito handles deployed authentication. The Vite frontend remains
unchanged. Local testing uses DynamoDB Local and a standalone local HTTP runner;
it does not deploy resources or need an AWS account.

## Requirements

- Node.js 20+ and npm
- Docker Desktop with Docker Compose

## Run locally on Windows

From the project root:

```powershell
cd backend
npm install
docker compose up -d
npm run local:db:init
npm run local:db:check
npm run local:api
```

The API listens at `http://127.0.0.1:3001`; `local:api` builds the TypeScript
handler before starting it. Database initialization creates `revive-local` if
needed, then seeds five demo centers and maps the local center operator to
GreenLoop. Check `/health`, `/health/db`, and `/centers`.

The local API uses test identities instead of Cognito. Send
`x-local-role: resident`, `delivery`, or `center`; their default IDs are
`local-resident`, `local-delivery`, and `local-center`. You can set another
identity with `x-local-user`. This mock identity support exists only in the
standalone local server. The deployed Lambda continues to require valid Cognito
JWTs and group membership.

With the API running, open a second terminal, `cd` into `backend`, and run
`npm run local:smoke`. It creates a unique resident pickup, advances it through
delivery and verification, confirms the reward balance, and checks that retrying
verification returns `409` without a second award. The separate
`npm run local:db:check` command verifies the primary key, all three active GSIs,
the five seeded centers, the four-center available directory, and the local
GreenLoop owner mapping.

## Exercise the full pickup and reward flow

Keep the API running, then run these commands in a second PowerShell terminal:

```powershell
$base = "http://127.0.0.1:3001"
$resident = @{ "x-local-role" = "resident" }
$delivery = @{ "x-local-role" = "delivery" }
$center = @{ "x-local-role" = "center" }

$schedule = (Get-Date).AddDays(1).ToUniversalTime().ToString("o")
$pickupBody = @{
  wasteCategory = "Plastic"
  quantityKg = 2
  pickupAddress = "1 Local Test Road"
  scheduledAt = $schedule
  centerId = "center_greenloop"
  instructions = "Local end-to-end test"
} | ConvertTo-Json

$pickup = Invoke-RestMethod -Method Post -Uri "$base/pickups" -Headers $resident -ContentType "application/json" -Body $pickupBody
$id = $pickup.pickup.id
Invoke-RestMethod -Method Post -Uri "$base/pickups/$id/accept" -Headers $delivery

$collected = @{ status = "Collected" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$base/pickups/$id/status" -Headers $delivery -ContentType "application/json" -Body $collected

$delivered = @{ status = "Delivered to Center" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$base/pickups/$id/status" -Headers $delivery -ContentType "application/json" -Body $delivered

$verification = @{ verifiedWeightKg = 1.7; note = "Local test received" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/pickups/$id/verify" -Headers $center -ContentType "application/json" -Body $verification
Invoke-RestMethod -Method Get -Uri "$base/rewards" -Headers $resident
```

For 1.7 kg of Plastic, the response should show 34 points. Verifying the same
pickup again returns `409` without awarding points twice.

Stop the API with Ctrl+C. Stop DynamoDB Local with `docker compose down` from
the `backend` directory. The database is in memory and resets when its
container stops.

## AWS resources

`template.yaml` defines the API Gateway HTTP API, Cognito user pool, Lambda
handler, and pay-per-request DynamoDB table with three secondary indexes. The
template does not create resources until you explicitly deploy it with AWS SAM.
For deployed center verification, map an approved center operator's Cognito
subject onto its center profile using GSI1 keys `OWNER#<subject>` /
`CENTER#<centerId>` and add the user to `RecyclingCenters`.
