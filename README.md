# ReVive

**Turn waste into worth.** ReVive connects residents, delivery partners, recycling centers, and administrators in a recycling pickup workflow. Residents schedule pickups, partners collect and deliver recyclable material, centers verify received weight, and the system records points and coupon redemptions.

## What you can do

- **Residents:** use the map to find recycling centers, schedule and track pickups, manage a profile, submit complaints, earn points after center verification, and redeem coupons from the catalog.
- **Delivery partners:** review available pickups, accept jobs, update collection and delivery status, view routes, and see earnings estimates.
- **Recycling centers:** manage center details, review assigned pickups, record received weight, and verify recycling.
- **Administrators:** view platform activity and charts, review accounts and partner applications, approve or suspend accounts, manage pickups and complaints, and configure points and coupons.

ReVive has four role-specific account types: resident, delivery partner, recycling center, and administrator. Residents, delivery partners, and centers use email and password to register and sign in; administrators are provisioned by a trusted operator. AWS mode uses Amazon Cognito for email confirmation, sign-in, password recovery, and access tokens. The Vercel/Supabase mode uses Supabase Auth for account authentication. Local development uses its own localhost-only authentication flow.

Maps support center discovery and location-aware pickup coordination. Pickup status and timeline make progress visible across the resident, delivery, center, and admin workflows. Dashboard charts summarize available platform and activity data. Points are recorded after the center verifies received weight, and coupon redemptions update the points balance and redemption history through the configured backend.

## Why ReVive matters

Recyclable material is more likely to be recovered when people have a convenient way to hand it over and can see what happens next. ReVive brings the handoff, collection, center verification, and resident reward record into one workflow. That can make recycling easier to act on and easier for participating organizations to coordinate.

The intended real-world benefits are:

- **More convenient recycling:** residents can request a pickup and find a center that accepts the material.
- **Clearer accountability:** pickup status and timeline show progress from request through delivery and center verification.
- **Verified records:** centers record received weight; points are calculated from that verified amount, creating a record of material handled.
- **Better coordination:** delivery partners can find and claim available jobs, while centers and administrators manage their parts of the process.
- **A reason to participate:** points and a coupon catalog give residents a visible reward for verified recycling.

These are the outcomes ReVive is designed to support. Actual environmental impact depends on real pickups, material being properly processed, and participation by local residents, delivery partners, and centers. The app does not independently verify that material is recycled after center intake or calculate emissions avoided.

## Technology

| Area | Technology |
|---|---|
| Frontend | React, Vite, React Router, Tailwind CSS |
| Maps and charts | Leaflet, OpenStreetMap, optional Mapbox address lookup, OSRM routing, Recharts |
| Local backend | Node.js, TypeScript, AWS SDK, DynamoDB Local |
| AWS backend | AWS SAM, API Gateway HTTP API, Lambda, DynamoDB, Cognito |
| Alternate hosted backend | Vercel Functions and Supabase |

The root `api/` and `supabase/` folders provide the Vercel/Supabase option. The `backend/` folder contains the AWS SAM API and local DynamoDB development tools. These are separate backend options; choose one API mode for a frontend deployment.

## Run locally

### Requirements

- Node.js 20.19+ or 22.12+
- npm
- Docker Desktop, for the local DynamoDB backend
- PowerShell on Windows (commands below use PowerShell syntax)

### 1. Configure and install the frontend

From the repository root:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
```

The example selects the local API at `http://127.0.0.1:3001`. To use address search, set `VITE_MAPBOX_ACCESS_TOKEN` in `.env.local`; map pins can be placed manually without it. Keep `.env.local` private and do not commit credentials.

### 2. Start DynamoDB Local and the API

In a second terminal:

```powershell
cd backend
npm ci
docker compose up -d
npm run local:db:init
npm run local:db:check
npm run local:admin:create
npm run local:api
```

Create the local administrator when prompted. The API listens on `http://127.0.0.1:3001`; DynamoDB Local listens on port `8000`. The local API uses development-only role headers and bypasses Cognito. Keep it on localhost and never expose it publicly.

### 3. Start the Vite frontend

In another terminal, from the repository root:

```powershell
npm run dev
```

Open the URL Vite prints, usually `http://localhost:5173`. Register resident, delivery-partner, and recycling-center accounts in the app. Use the local administrator to approve partner applications. Then run a pickup through partner collection, center verification, and resident rewards.

DynamoDB Local is configured in memory. Its records are lost when its container is removed. Avoid `docker compose down` if you want to keep the current local data.

## Useful commands

Run frontend commands from the repository root:

```powershell
npm run dev
npm run build
npm run lint
```

Run backend commands from `backend/`:

```powershell
npm run build
npm run typecheck
npm run local:db:check
npm run local:smoke
npm run local:cleanup-smoke
```

The smoke test exercises the local API and cleans up its uniquely named test records. `local:cleanup-smoke` can clean up records left by an interrupted run. These commands require the local DynamoDB and API where noted; they do not deploy AWS resources.

## Configure an API mode

The frontend reads `VITE_API_MODE` and `VITE_API_BASE_URL` at build time. Restart Vite after changing `.env.local`, and rebuild/redeploy a hosted frontend after changing its environment variables.

| Mode | Purpose | Configuration |
|---|---|---|
| `local` | Local API and DynamoDB Local | `.env.example` defaults to `http://127.0.0.1:3001` |
| `vercel` | Vercel API functions with Supabase | Follow [`docs/vercel-deployment.md`](docs/vercel-deployment.md) for environment variables and setup |
| `aws` | AWS API Gateway and Cognito | Set the deployed API URL; see [`docs/aws-frontend.env.example`](docs/aws-frontend.env.example) and [`docs/aws-vercel-full-stack-deployment.md`](docs/aws-vercel-full-stack-deployment.md) |

Only `VITE_*` values are suitable for the browser bundle. Never put AWS credentials or the Supabase service-role key in a `VITE_*` variable. Do not expose the local API to the public internet.

## Deployment guides

- **Vercel + Supabase:** [`docs/vercel-deployment.md`](docs/vercel-deployment.md) covers the frontend, API functions, database setup, environment variables, and first administrator.
- **AWS SAM backend + Vercel frontend:** [`docs/aws-vercel-full-stack-deployment.md`](docs/aws-vercel-full-stack-deployment.md) covers the AWS stack and connecting the frontend.
- **AWS Amplify frontend:** The root [`amplify.yml`](amplify.yml) builds the Vite app from the repository root. The backend remains a separately managed AWS SAM deployment.

The SAM template defines an API Gateway HTTP API, one Lambda function, a Cognito user pool/client and role groups, and a DynamoDB table with three GSIs. AWS deployment and billing are separate from hosting the static frontend; review the deployment guide and the CloudFormation change set before creating or updating resources. The DynamoDB table has deletion protection and retention settings.

## Security and operational notes

- AWS API requests use Cognito access tokens; backend role checks also enforce account status and resource ownership.
- The first AWS administrator must be provisioned by a trusted operator. Ordinary signup does not grant admin membership. Follow the first-admin instructions in the AWS deployment guide.
- Local development authentication is intentionally different from AWS authentication and is only for localhost.
- Recycling-center evidence uploads to S3 are not implemented.
- The app uses an external OSRM demo routing endpoint by default. Mapbox address lookup is optional and requires a token.

## Repository layout

```text
.
├── api/
│   └── [...path].js            Vercel serverless API
├── backend/
│   ├── scripts/                Local database, admin, API, and smoke-test tools
│   ├── src/handler.ts          AWS Lambda handler
│   ├── docker-compose.yml      DynamoDB Local service
│   ├── local-env.json          Local SAM environment settings
│   ├── samconfig.toml          SAM deployment settings
│   ├── template.yaml           AWS SAM resources
│   └── package.json
├── docs/                       API, data design, and deployment guides
├── public/                     App icons and static assets
├── src/
│   ├── components/             Shared interface components
│   ├── context/                Authentication and app state
│   ├── dashboards/             Admin, center, delivery, and resident pages
│   ├── pages/                  Landing, sign-in, and registration screens
│   ├── services/               API, data, maps, and earnings logic
│   └── utils/                  Shared validation and formatting
├── supabase/schema.sql         Vercel backend database schema
├── .env.example                Local frontend environment template
├── amplify.yml                 Amplify frontend build settings
├── index.html                  Vite HTML entry point
├── package.json                Frontend scripts and dependencies
├── vercel.json                 Vercel build and SPA routing settings
└── vite.config.js              Vite configuration
```

This is a source-oriented overview; dependency folders, `dist/`, and the checked-in bundled `fn/` output and `fn.zip` archive are omitted. Local `.env.local` settings are not part of the source layout.
