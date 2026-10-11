# ReVive — Recycling Marketplace (Frontend Prototype)

ReVive is a multi-role marketplace that connects residents, delivery partners,
recycling centers, and platform admins around a simple loop: schedule a
pickup, have it collected and delivered, get it verified by a recycling
center, and earn reward points for responsible recycling.

The frontend supports both its original localStorage demo mode and an opt-in
local API mode. Local API mode connects account, pickup, center, delivery,
rewards, and coupon redemption data to the DynamoDB Local backend. Some
unsupported prototype features may still use browser-local demo data.
The local API uses mock role headers and is only for local development.

## Tech stack

- React + Vite
- Tailwind CSS v4 (forest/mint sustainability theme)
- React Router v7
- Lucide React icons
- Recharts for dashboard charts
- DynamoDB Local via the serverless TypeScript API for supported local flows
- `localStorage` for the existing demo auth and unsupported prototype features

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`). To build for
production: `npm run build` (output in `dist/`, already wired for AWS
Amplify Hosting via `amplify.yml`).

## Run the frontend with the local backend

Copy `.env.example` to `.env.local` (PowerShell: `Copy-Item .env.example .env.local`).
Then start DynamoDB Local and the API in one terminal:

```powershell
cd backend
docker compose up -d
npm run local:db:init
npm run local:api
```

If port 3001 is already in use, start the API on 3002 with
`$env:PORT='3002'; npm run local:api` and set
`VITE_API_BASE_URL=http://127.0.0.1:3002` in `.env.local`.

In a second terminal, from the project root, run `npm install` if needed and
`npm run dev`. The demo sign-in stays in place; use `user@revive.demo`,
`delivery@revive.demo`, or `center@revive.demo` with password `demo123` to
exercise the connected role dashboards. Schedule a pickup as the resident,
accept and advance it as the delivery partner, then verify it as the center.
The resident's rewards balance and ledger update after verification. Coupon
catalog records are seeded in DynamoDB Local; redemption atomically deducts
points and records the transaction. Voucher issuance and cash transfers are
not connected. Admin points-per-kilogram configuration and the reward snapshot
are also served by the local API.

The backend end-to-end check is `cd backend; npm run local:smoke` while the API
is running. It verifies pickup creation through reward credit and prevents a
duplicate award.

## Demo credentials

Password for every account is **`demo123`**. They're also listed on the
login screens so you don't have to remember them.

| Role | Email | Notes |
|---|---|---|
| Resident | `user@revive.demo` | Has pickup history, points, and reward activity |
| Delivery partner (approved) | `delivery@revive.demo` | Can accept and manage jobs |
| Delivery partner (pending) | `pending.delivery@revive.demo` | Shows the application-pending screen |
| Recycling center (approved) | `center@revive.demo` | Can confirm receipts and verify recycling |
| Recycling center (pending) | `pending.center@revive.demo` | Shows the application-pending screen |
| Administrator | `admin@revive.demo` | Sign in at `/admin/login` (not the regular login page) |

You can also register new resident, delivery partner, or recycling center
accounts from `/register`. Admin accounts cannot be created through public
registration.

## Routes

**Public**
`/` · `/login` · `/admin/login` · `/register` · `/register/user` ·
`/register/delivery` · `/register/center`

**Resident** (`/user/...`)
`dashboard` · `schedule-pickup` · `my-pickups` · `track/:id` · `rewards` ·
`centers` · `profile`

**Delivery partner** (`/delivery/...`)
`dashboard` · `jobs` · `jobs/:id` · `earnings` · `profile`
*(unapproved partners only see `profile` plus an application-pending screen)*

**Recycling center** (`/center/...`)
`dashboard` · `requests` · `verification` · `inventory` · `profile`
*(unapproved centers only see `profile` plus an application-pending screen)*

**Administrator** (`/admin/...`)
`dashboard` · `users` · `delivery-partners` · `centers` · `pickups` · `rewards`

## The core workflow

1. A resident schedules a pickup (`Requested`).
2. An approved delivery partner accepts it (`Accepted` → `Pickup Scheduled`).
3. The partner marks it collected, then delivered to the chosen recycling
   center (`Collected` → `Delivered to Center`).
4. The center confirms the received weight, then verifies the recycling
   (`Recycling Verified`).
5. **Only at verification** are reward points credited — never at request
   time, and never twice for the same pickup.
6. Points can be redeemed for simulated coupons, gift cards, or cash from
   the Rewards page, with balance and history tracked per user.

Admins can approve/reject delivery and center applications, suspend or
reactivate accounts, monitor every pickup, verify on a center's behalf when
needed, configure points-per-kg rates per waste category, review reward
transactions and complaints, and reset all demo data back to its seeded
state from the admin dashboard.

## Project structure

```
src/
  components/   reusable UI (DashboardLayout, StatCard, charts, dialogs, ...)
  context/      AuthContext, AppDataContext, ToastContext
  dashboards/   role-specific pages, grouped as user/ delivery/ center/ admin/
  data/         seed data for the mock database
  pages/        public pages — landing, login, registration
  services/     dataService.js (business logic) + storage.js (localStorage)
  utils/        constants, formatting, validation
```

All reads/writes go through `services/dataService.js`, which owns every
business rule (approval gating, status transitions, duplicate-reward
prevention, etc.) and notifies subscribed components via
`context/AppDataContext.jsx`. No component touches `localStorage` directly.

## Future AWS integration

The service layer is intentionally the only place that knows about
persistence, so it can be swapped out without touching any UI code:

- **Amazon Cognito** — replace `authenticate` / `registerUser` /
  `registerDelivery` / `registerCenter` in `dataService.js` with Cognito
  sign-up/sign-in calls; swap the local `session` object for Cognito's.
- **API Gateway + AWS Lambda** — replace each `dataService.js` function body
  with a `fetch`/SDK call to a corresponding endpoint; the function
  signatures are already shaped like a REST/RPC API.
- **Amazon DynamoDB** (or another database) — becomes the backing store
  behind those Lambda functions, replacing `services/storage.js`.
- **Amazon S3** — for the identity-verification and business-verification
  document uploads currently shown as placeholders during registration.

No AWS services are connected today — this app runs entirely client-side.

## Backend design

The backend starter uses AWS Lambda, API Gateway, Cognito, and DynamoDB. See
[`docs/api-contract.md`](docs/api-contract.md) for the first endpoints and
[`docs/dynamodb-design.md`](docs/dynamodb-design.md) for the access patterns.
The PostgreSQL schema at `docs/database-schema.sql` is retained as a reference
from the earlier design and is not used by the current backend.

## Backend starter

The separate [`backend/`](backend/README.md) directory contains the TypeScript
Lambda, Cognito, and DynamoDB starter and local DynamoDB setup. See its README
for local run steps.
The frontend remains a standalone Vite app.
