# ReVive local backend

The backend is TypeScript on Lambda/API Gateway with DynamoDB. Local development
uses DynamoDB Local and a standalone HTTP runner; it does not deploy AWS resources
or require AWS credentials. The local frontend uses real DynamoDB Local accounts
for residents, delivery partners, recycling centers, and administrators.

## Start locally on Windows

Use separate PowerShell terminals.

### 1. Start DynamoDB Local and initialize the table

```powershell
cd C:\Users\HP\Desktop\ReVive\backend
docker compose up -d
npm run local:db:init
npm run local:db:check
```

`local:db:init` creates the empty `revive-local` table if it is missing. The
directory and coupon catalog are populated only through account registration
and admin actions. The database runs in memory and is cleared by
`docker compose down`.

### 2. Create your local administrator

```powershell
npm run local:admin:create
```

Enter your own email, password (at least 8 characters), and display name when
prompted. The password input is hidden. This creates a real local account in
DynamoDB Local. There is no built-in demo administrator account.

### 3. Start the API

```powershell
npm run local:api
```

The local API listens at `http://127.0.0.1:3001`. It enables local role headers
only in this standalone development runner; do not expose it to the internet.

### 4. Start the frontend

In another terminal:

```powershell
cd C:\Users\HP\Desktop\ReVive
npm run dev
```

Open the Vite URL it prints (normally `http://localhost:5173`). Local mode is set
in `.env.local`. Restart Vite after changing that file.

## Approval and pickup workflow

1. Register a recycling center and a delivery partner from the website. Both
   applications and password hashes are stored in `revive-local` with pending
   approval status. Re-register any center application that was created before
   local backend registration was connected; old browser-only applications are
   not migrated.
2. Open `http://localhost:5173/admin/login` and sign in with the admin account
   created above. Use **Centers** and **Delivery partners** to approve the new
   applications. These approvals persist in DynamoDB Local.
3. Sign out and sign back in to the approved center and delivery accounts so the
   browser session picks up the approved status.
4. A resident schedules a pickup to an approved center. The delivery partner
   accepts it under **Jobs**, marks it **Collected**, then **Delivered to Center**.
5. The center opens **Verification**, enters the received weight, and confirms.
   The pickup, timeline event, reward ledger entry, and resident points balance
   are written to DynamoDB Local. A repeat verification is rejected to avoid a
   duplicate reward.
6. Sign in as the resident and redeem a coupon from **Rewards**. The API checks
   the resident's current balance and active coupon, then deducts points and
   writes the redemption ledger entry in one DynamoDB transaction. Voucher
   delivery and cash transfers are not implemented; redemption is recorded,
   but fulfilment remains simulated.
7. As an administrator, open **Rewards & configuration** to add a coupon,
   edit its title, partner, category, or point cost, and activate or deactivate
   listings. Deactivation hides a coupon from residents while preserving its
   past redemption records.

To view account profiles stored in the local table (password hashes are never
included):

```powershell
cd C:\Users\HP\Desktop\ReVive\backend
npm run local:users:list
```

## Local verification commands

With DynamoDB Local running, `npm run local:db:check` checks the table schema.
With the API running, `npm run local:smoke` exercises resident, delivery,
center, and admin APIs through approval, pickup delivery, verification, and
reward issuance. It removes the uniquely named test accounts and linked records
when it finishes. `npm run local:cleanup-smoke` removes any such records left by
an earlier run.

## AWS deployment status

No AWS resources are created by these commands. Production authentication stays
on Cognito and was not changed as part of local integration. The SAM template
defines the AWS API routes, DynamoDB permissions, and Cognito role groups,
including `PlatformAdmins`. AWS sign-up creates resident, delivery, or center
DynamoDB profiles; partner profiles remain pending until an admin approves
them, at which point the backend adds the matching Cognito group. Admin access
requires both the `PlatformAdmins` group and an active, approved DynamoDB admin
profile. Follow the first-admin provisioning steps in
`../docs/aws-vercel-full-stack-deployment.md` before enabling admin use.

The React frontend supports local, Vercel, and AWS API modes. AWS signup uses
Cognito email confirmation and access tokens refresh through the backend.
At first login, an existing Cognito user with a verified email and no group is
provisioned as a standard resident with no privileges. Users already assigned
to a partner or admin group are never inferred or auto-approved: a trusted
operator must create the matching DynamoDB business/admin profile and approval
state. Admin access requires both the `PlatformAdmins` Cognito group and an
active, approved admin profile. Evidence uploads are not implemented; a private
S3 upload flow is a future enhancement.
