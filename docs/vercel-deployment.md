# Deploy ReVive on Vercel without AWS

This setup serves the Vite frontend and API from Vercel and stores shared accounts,
pickups, complaints, coupons, and reward history in Supabase. It replaces the
AWS Lambda, DynamoDB, and Cognito deployment path. It does not import existing
AWS data automatically.

## 1. Create the Supabase project

Create a Supabase project, then open **SQL Editor** and run all of
[`../supabase/schema.sql`](../supabase/schema.sql). The schema enables row-level
security and is designed for access through the server-side Vercel API only.

In Supabase **Project Settings → API**, copy the project URL, publishable/anon
key, and service-role/secret key. Never put the service-role key in a `VITE_`
variable or commit it to the repository.

## 2. Create the first administrator

In Supabase **Authentication → Users**, create and confirm an administrator
user. Then run this SQL with that exact email (replace the example address):

```sql
insert into public.accounts (id, email, role, name, status, approval_status)
select id, email, 'admin', coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)), 'active', 'approved'
from auth.users
where lower(email) = lower('admin@example.com')
on conflict (id) do update set role = 'admin', status = 'active', approval_status = 'approved';
```

## 3. Deploy the repository to Vercel

Import the repository as a Vercel project. The included `vercel.json` builds the
Vite site and sends application routes to `index.html`; `/api/*` is handled by
the Vercel function in `api/[...path].js`.

Add these project environment variables for **Production**, **Preview**, and
**Development** as needed:

| Variable | Value |
|---|---|
| `VITE_API_MODE` | `vercel` |
| `VITE_API_BASE_URL` | `/api` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key |
| `SUPABASE_URL` | Same Supabase project URL |
| `SUPABASE_ANON_KEY` | Same publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role/secret key |

Redeploy after adding the variables. Register a resident, center, and delivery
partner through the app; approve center and delivery applications in the admin
dashboard. Existing AWS accounts and records need a separate migration if they
must be retained.

## Notes

- Vercel Hobby is intended for personal, non-commercial projects and has usage
  limits. Supabase Free also has limits and can pause inactive projects.
- This API uses the Supabase service-role key only on the server. Do not expose
  it in browser code or logs.
- Address lookup and road routing remain separate services from the database.
