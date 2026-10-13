# ReVive

**Turn waste into worth.** ReVive helps households recycle more consistently by connecting residents, delivery partners, recycling centers, and platform administrators in one traceable workflow. This means waste is easier to collect, routes are more organized, and verified recycling activity can turn into visible rewards instead of lost material or missed pickups.

Residents schedule and track pickups, compare eligible recycling centers, and receive points after recycling is verified. Delivery partners accept jobs, update collection and delivery status, and review estimated earnings. Recycling centers confirm received weights and verify materials. Administrators oversee accounts, applications, pickup activity, reward rates, and the coupon catalog.

## Product capabilities

- Role-specific workspaces for residents, delivery partners, recycling centers, and administrators.
- Pickup scheduling and status tracking from request through center verification.
- Map-based address selection and center recommendations using saved map pins. Leaflet and OpenStreetMap provide the map; Mapbox supports address lookup when configured. Road distances use OSRM driving routes when available.
- Reward points credited from the recycling center’s verified weight and category rate. The ledger prevents awarding points twice for the same pickup.
- Coupon catalog management for administrators. Residents can redeem points, and each redemption is recorded with the updated balance. Voucher fulfillment and cash transfers are not connected.
- Delivery earnings estimates based on verified pickups, route distance, verified weight, and configured bonuses. The application does not transfer payments.
- Local persistence through DynamoDB Local for the connected workflows. Some screens also support a browser-storage preview mode; that data remains in the current browser and is separate from the backend database.

## Technology

| Area | Tools |
|---|---|
| Frontend | React 19, Vite, React Router, Tailwind CSS 4 |
| Maps and charts | Leaflet, React Leaflet, OpenStreetMap, Mapbox geocoding, OSRM routing, Recharts |
| Backend | Node.js, TypeScript, AWS SDK for JavaScript |
| Local data | DynamoDB Local and a local HTTP API runner |
| AWS architecture | AWS SAM, API Gateway HTTP API, Lambda, DynamoDB, Cognito |

## Deploy the complete app without AWS

The Vercel deployment uses Vercel for the Vite frontend and API functions, and
Supabase for shared data and authentication. Follow
[`docs/vercel-deployment.md`](docs/vercel-deployment.md) to create the database,
configure environment variables, and provision the first administrator. The
Supabase service-role key must stay in Vercel's server-only environment and
must never use a `VITE_` prefix.

## Run locally on Windows

Requirements: Node.js with npm, Docker Desktop, and PowerShell.

### 1. Configure the frontend

From the repository root, create `.env.local` from the example only if you do not already have one. This preserves any existing Mapbox key or local settings.

```powershell
cd C:\Users\HP\Desktop\ReVive
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm install
```

The default configuration points the frontend at the local API on port `3001`. To enable address search, set `VITE_MAPBOX_ACCESS_TOKEN` in `.env.local`. Map pins can still be placed manually without a Mapbox key.

### 2. Start the local database and API

In a separate PowerShell terminal:

```powershell
cd C:\Users\HP\Desktop\ReVive\backend
npm install
docker compose up -d
npm run local:db:init
npm run local:db:check
npm run local:admin:create
npm run local:api
```

Create an administrator when prompted. The password input is hidden. The local API listens at `http://127.0.0.1:3001` and uses development-only role headers; keep it on localhost and do not expose it publicly.

### 3. Start the frontend

In another terminal:

```powershell
cd C:\Users\HP\Desktop\ReVive
npm run dev
```

Open the Vite address printed in the terminal, usually `http://localhost:5173`. Register resident, delivery partner, and recycling center accounts through the website. Use the administrator account created above to approve delivery partners and centers.

The local database runs in memory. Its records are lost when the DynamoDB Local container is removed with `docker compose down`; avoid that command while you need the current local data.

## Pickup and rewards workflow

1. A resident schedules a pickup and selects an eligible recycling center.
2. An approved delivery partner accepts the job and marks it collected and delivered.
3. The center records the received weight and verifies the recycling.
4. ReVive credits resident points and records the reward transaction only after verification.
5. The resident can redeem an active coupon if their points balance covers its cost. Redemption deducts points and creates a ledger entry; fulfillment is not yet integrated.

Administrators can approve accounts, manage coupon listings, update reward rates, and review pickup and reward activity.

## Useful local commands

Run these from `backend/`:

```powershell
npm run local:db:check       # Check the local table schema
npm run local:users:list     # List local account profiles without password hashes
npm run local:smoke          # Exercise the local pickup-to-reward API workflow
```

The smoke workflow creates test records in DynamoDB Local. Since the database is in memory, stopping/removing the database clears those records along with other local data.

## Architecture and deployment status

The backend is structured for AWS Lambda and API Gateway, and [`backend/template.yaml`](backend/template.yaml) describes the planned API Gateway HTTP API, Lambda, Cognito, and DynamoDB resources. DynamoDB Local and the standalone API runner are used for local development; local commands do not create AWS resources.

**The application has not been deployed to AWS.** The SAM template is a deployment starting point, not confirmation of a production-ready stack. Before staging, align all frontend API calls with deployed routes and IAM policies, complete Cognito role and administrator provisioning, configure production origins and secrets, and verify authentication and authorization end to end. Production authentication has not been changed by the local setup.

The frontend can be built with `npm run build`; the output is written to `dist/`. Hosting options such as Amazon S3 with CloudFront or Amplify can be configured when preparing a staging environment.

## Repository layout

```text
src/
  components/       Shared interface components
  context/          Authentication and application data state
  dashboards/       Resident, delivery, center, and admin workspaces
  pages/            Landing, sign-in, and account registration pages
  services/         API client, data handling, maps, and delivery earnings
backend/
  src/              TypeScript Lambda handler
  scripts/          Local database, admin, and API utilities
  template.yaml     AWS SAM architecture
docs/               API contract, data design, and project materials
```
