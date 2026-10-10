# ReVive — Recycling Marketplace (Frontend Prototype)

ReVive is a multi-role marketplace that connects residents, delivery partners,
recycling centers, and platform admins around a simple loop: schedule a
pickup, have it collected and delivered, get it verified by a recycling
center, and earn reward points for responsible recycling.

**This is a frontend-only prototype.** There is no backend, database, or real
payment/auth system — everything is simulated with mock data and persisted
to your browser's `localStorage`. A yellow "Demo mode" banner appears
throughout the app as a reminder that none of this is production-secure.

## Tech stack

- React + Vite
- Tailwind CSS v4 (forest/mint sustainability theme)
- React Router v7
- Lucide React icons
- Recharts for dashboard charts
- `localStorage` for all persistence, behind a service layer designed to be
  swapped for real API calls later

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`). To build for
production: `npm run build` (output in `dist/`, already wired for AWS
Amplify Hosting via `amplify.yml`).

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
