# Complete deployment guide: Vercel + Supabase

This deploys the whole ReVive application without AWS:

- Vercel serves the React/Vite site and its `/api/*` serverless API.
- Supabase provides shared PostgreSQL storage and account authentication.
- Leaflet/OpenStreetMap displays maps. OSRM estimates road distances. Address
  lookup requires a configured Mapbox token; users can still place map pins
  manually without one.

This deployment starts with a new, empty database. It does not copy accounts or
records from DynamoDB Local or AWS. Do not use the local API runner on the public
internet; its role headers are for local development only.

## Before you start

You need:

1. This repository pushed to a Git provider that Vercel can access.
2. A Vercel account and a Supabase account.
3. Node.js and npm if you want to build locally before deploying.

Vercel Hobby and Supabase Free have usage limits and can change their terms.
Check each provider's current plan limits before relying on the app for a public
or production service.

## 1. Create and configure the Supabase database

1. Create a new Supabase project and save its database password somewhere
   secure.
2. In Supabase, open **SQL Editor → New query**.
3. Copy all of [`../supabase/schema.sql`](../supabase/schema.sql) into the query
   and run it. This creates the tables, indexes, access restrictions, and
   database functions used by the API.
4. Open **Project Settings → API** and copy:
   - Project URL
   - Publishable key (or legacy `anon` key)
   - Service role key (or secret key)

The service-role key gives server-side code elevated database access. Keep it
secret. Never put it in a `VITE_*` variable, browser code, Git, or a public issue.

## 2. Create the first administrator

Public registration intentionally does not allow creating administrator
accounts.

1. In Supabase, open **Authentication → Users → Add user**.
2. Create the administrator using the email and password you will use at
   `/admin/login`. Mark the email confirmed if Supabase offers that option.
3. In **SQL Editor**, run the statement below after replacing the sample email
   with the exact administrator email:

```sql
insert into public.accounts (id, email, role, name, status, approval_status)
select id, email, 'admin', coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)), 'active', 'approved'
from auth.users
where lower(email) = lower('admin@example.com')
on conflict (id) do update
set role = 'admin', status = 'active', approval_status = 'approved';
```

The SQL should insert one row. If it inserts zero, check that the address in the
query exactly matches the user in **Authentication → Users**.

## 3. Import the repository into Vercel

1. In Vercel, choose **Add New → Project** and import this repository.
2. Set the **Root Directory** to the repository root (the folder containing the
   root `package.json` and `vercel.json`).
3. Use these build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
4. Add the environment variables in the next section before the first deploy.
5. Deploy. Vercel will provide a URL ending in `vercel.app`.

The included `vercel.json` sends browser page routes to the Vite app. The
serverless function in `api/[...path].js` handles API requests on the same
domain, so no separate API host or CORS configuration is needed.

## 4. Add Vercel environment variables

In **Project → Settings → Environment Variables**, add the following values for
the environments you will use. For a first deployment, select **Production**;
select Preview and Development too if you will use those environments.

| Name | Value | Visibility |
|---|---|---|
| `VITE_API_MODE` | `vercel` | Public build setting |
| `VITE_API_BASE_URL` | `/api` | Public build setting |
| `VITE_SUPABASE_URL` | Your Supabase project URL | Public build setting |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key | Public build setting |
| `SUPABASE_URL` | Same Supabase project URL | Server environment |
| `SUPABASE_ANON_KEY` | Same publishable/anon key | Server environment |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role/secret key | **Server-only secret** |

`VITE_*` values are included in the browser bundle. The anon/publishable key is
designed to be public; the service-role key is not. Do not add the service-role
key to `.env.vercel.example` or any `VITE_*` variable.

Optional variables:

| Name | When to set it |
|---|---|
| `VITE_MAPBOX_ACCESS_TOKEN` | Enables address search and address autofill. Without it, manual map-pin placement still works. |
| `VITE_OSRM_BASE_URL` | Leave unset to use the configured public OSRM demo endpoint, or set a compatible routing service URL. |

After changing environment variables, use **Deployments → Redeploy** so the
frontend is rebuilt with the new public settings and the API functions receive
the server settings.

For local Vercel-mode development, copy the values from
`.env.vercel.example` into `.env.local` and fill in your own Supabase URL and
public key. Keep the existing `.env.local` backup and never paste the service
role key into the frontend environment file.

## 5. Verify the live deployment

Use the deployed Vercel URL for these checks:

1. Open `/api/centers`. It should return JSON with an empty `items` array on a
   new database. An API configuration or SQL error here means a Vercel
   environment variable is missing or the schema was not run.
2. Open the home page, then register a resident account. The user should reach
   the resident dashboard and remain signed in after a refresh.
3. Register a delivery partner and a recycling center. Their applications
   should appear as pending in the admin dashboard.
4. Sign in at `/admin/login` using the administrator from step 2. Approve the
   delivery partner and center.
5. Sign out and back in as the approved accounts. A resident can now schedule a
   pickup; a delivery partner can claim it, mark it collected, then delivered;
   the center can verify the received weight.
6. Confirm that the resident's points and redemption history update. Add a
   coupon first under the admin rewards page; a new database has no sample
   coupons.
7. Submit a complaint and confirm it appears for the sender and administrator.

Use Vercel **Functions → Logs** for API runtime errors. Check Supabase **Logs →
API/Auth** if a request reaches Supabase but fails there. Do not share logs that
contain tokens or secret environment values.

## 6. Updating the deployment

Push changes to the connected Git branch. Vercel builds a deployment
automatically. Production uses the configured production branch; other branches
create preview deployments. If a deployment fails, inspect its **Build Logs**
before changing environment variables or database data.

Database changes belong in `supabase/schema.sql` (or a new versioned migration)
and must be applied to the Supabase project before code that depends on them is
deployed.

## Troubleshooting

- **The page works, but dashboards show API errors:** verify `VITE_API_MODE`,
  `VITE_API_BASE_URL`, and all three server Supabase variables, then redeploy.
- **`/api/centers` returns a missing table/function error:** rerun the schema SQL
  in the correct Supabase project.
- **Admin login succeeds nowhere:** verify that the auth user exists and that
  its matching `public.accounts` row has `role = 'admin'` and `status = 'active'`.
- **A center or delivery account cannot perform actions:** approve it in the
  admin dashboard, then sign in to that account again.
- **Address lookup buttons are disabled:** add `VITE_MAPBOX_ACCESS_TOKEN` and
  redeploy, or set locations with the map pins.
- **A reward list is empty:** add coupons as an administrator; this project
  intentionally has no seeded/demo coupon rows.
