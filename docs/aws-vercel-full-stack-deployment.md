# Full-stack deployment: AWS backend + Vercel frontend

This guide covers the split deployment discussed for ReVive:

- Vercel hosts the React/Vite frontend.
- AWS SAM provisions API Gateway, Lambda, DynamoDB, and Cognito from
  `backend/template.yaml`.
- The Vercel frontend calls the deployed AWS API using Cognito access tokens.

## Deployment readiness: finish this before a public launch

The AWS mode uses the API URL and Cognito tokens returned by the backend.
The local API sends role and user IDs in headers and must never be exposed
publicly. The backend creates profiles at signup, confirms email through
Cognito, refreshes sessions server-side, and assigns partner groups only after
admin approval.

The SAM commands below provision resources; they do not make the existing
React workflows work against AWS by themselves. Do not set
`VITE_API_MODE=local` on a public Vercel deployment.

## Architecture

```text
Browser ── HTTPS ──> Vercel (Vite frontend)
   │                       │
   │ Cognito access token  │ API requests
   └───────────────────────┴──> API Gateway HTTP API
                                     │
                                     v
                               Lambda function
                                │          │
                                v          v
                            DynamoDB    Cognito
```

## 1. Prepare provider accounts and tools

1. Push the repository to GitHub or another Git provider connected to Vercel.
2. Create or choose an AWS account. Configure billing alerts or a budget before
   provisioning resources.
3. Install Node.js/npm, the AWS CLI, and the AWS SAM CLI.
4. Configure AWS CLI credentials for a deployment identity allowed to create
   CloudFormation stacks, Lambda functions, API Gateway APIs, DynamoDB tables,
   Cognito user pools, IAM roles/policies, and the SAM deployment S3 bucket.
5. From the repository root, install frontend dependencies:

```powershell
npm install
```

## 2. Create the Vercel project to get its frontend URL

1. In Vercel, choose **Add New → Project** and import this repository.
2. Set the root directory to the repository root.
3. Use **Vite**, build command `npm run build`, and output directory `dist`.
4. Deploy once to get the project's `https://<name>.vercel.app` URL.

The initial site is only a deployment placeholder until the AWS configuration
below is set.

## 3. Deploy AWS infrastructure with SAM

From PowerShell, run:

```powershell
cd C:\Users\HP\Desktop\ReVive\backend
npm install
npm run build
sam build
sam deploy --guided
```

In the guided prompts:

- Choose a unique stack name, such as `revive-project`.
- Select the AWS region where you want the stack.
- Set `AllowedOrigins` to the exact Vercel origin, for example
  `https://revive-project.vercel.app` (no trailing slash). Include a preview
  origin only if previews need API access.
- Review the proposed resources before confirming deployment.
- Save the SAM configuration when prompted.

SAM's guided deployment is the documented first-deploy flow for this project.
[AWS SAM deployment guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/using-sam-cli-deploy.html)

The template enables DynamoDB point-in-time recovery and deletion protection.
The table is retained when the stack is deleted. Review those settings and AWS
charges before deployment; deleting the Vercel project does not delete AWS
resources.

## 4. Record the AWS stack outputs

Run:

```powershell
sam list stack-outputs --stack-name revive-project
```

Record these outputs for the frontend integration:

- `ApiUrl`
- `UserPoolId`
- `UserPoolClientId`
- The selected AWS region

Do not publish AWS credentials, Cognito tokens, or other secrets in the
repository. The Cognito app client ID and API URL are identifiers, not secret
keys; the service credentials used by SAM must remain private.

Check the deployed API health endpoint:

```powershell
Invoke-RestMethod -Method Get -Uri "<ApiUrl>/health"
Invoke-RestMethod -Method Get -Uri "<ApiUrl>/health/db"
```

Both should report a healthy response before proceeding.

## 5. Connect the frontend to the deployed backend

Configure the frontend for the AWS adapter:

1. Set `VITE_API_MODE=aws` and
   `VITE_API_BASE_URL=<ApiUrl>` in Vercel. The browser can use the backend's
   `/auth/signup` and `/auth/login` routes, so pool credentials need not be
   exposed to client code.
2. `src/services/backendApi.js` sends Cognito access tokens as
   `Authorization: Bearer <token>` and never sends local role/user headers in
   AWS mode. Signup prompts for the Cognito email confirmation code; successful
   confirmation returns the user to sign in.
3. The backend refreshes access tokens through `/auth/refresh` using the
   refresh token and configured Cognito app client. It preserves the refresh
   token and retries an expired API request once.
4. Check each dashboard action uses its matching AWS API route and display the
   pending state for delivery and center applications until an admin approves
   them.

For local frontend development against AWS, copy `docs/aws-frontend.env.example` to
`.env.local` and set the API URL. Keep Cognito service credentials out of Vite
environment variables; only the public API URL is needed by the browser.

The backend derives identity and groups from API Gateway's validated Cognito
JWT. Never treat a role or account ID sent in a browser request as proof of
identity.

Do not pass a role or account ID from the browser as proof of identity. The AWS
API uses Cognito JWT authorization, and the backend must derive the caller's
identity from the validated token. The Vercel API route is not needed for this
architecture unless you intentionally add a secure proxy.

After adding the completed AWS adapter and its environment variables in Vercel,
redeploy the frontend. Add the production Vercel origin to `AllowedOrigins` and
redeploy the SAM stack whenever the frontend origin changes.

## 6. Configure the first administrator and partner roles

The SAM template creates the `PlatformAdmins`, `DeliveryPartners`, and
`RecyclingCenters` Cognito groups, but it does not assign users to them or create
account profiles. Admin endpoints require both membership in `PlatformAdmins`
and an active DynamoDB account profile with `role: admin`,
`approvalStatus: approved`, and `status: active`.

Provision the first administrator manually as a trusted AWS operator:

1. In the Cognito User Pool console, create a user for the named administrator
   and confirm the account. Require MFA for administrator access where the
   deployment's sign-in flow supports it.
2. Find that user's immutable Cognito `sub` value in the user details.
3. In **Groups**, add the user to `PlatformAdmins`. Only a trusted operator
   should perform this step; never expose group assignment through a public API
   or browser action.
4. In the ReVive DynamoDB table, create the account profile whose partition key
   is `ACCOUNT#<sub>` and sort key is `PROFILE`. Set `id` to the same `sub`,
   `role` to `admin`, `approvalStatus` to `approved`, `status` to `active`, and
   include the administrator's `email`, `name`, `points: 0`, `createdAt`, and
   `updatedAt`. Also set `GSI1PK` to `EMAIL#<email>` and `GSI1SK` to
   `ACCOUNT#<sub>`, matching the normal account profile format. Use the Cognito
   `sub`, not an email address, as the account ID.
5. Have the administrator sign in again so the access token contains the new
   group claim. Confirm that admin endpoints work and that a normal account
   receives `403` from them.

Do not promote users automatically during sign-up. The signup endpoint rejects
the `admin` role; ordinary users receive no Cognito group. Delivery and center
profiles start as pending and receive their matching group only when an
administrator approves them. Center access also checks center ownership.

### Evidence uploads are future work

The current backend does not accept or store evidence files. A future upload
feature should use a private S3 bucket, short-lived presigned upload/download
URLs, account and pickup ownership checks, and narrowly scoped Lambda
permissions. No evidence bucket or upload route is created by this template.

## 7. Full workflow smoke check

Once the production frontend adapter and account provisioning are complete,
verify the deployed workflow in this order:

1. Register and sign in as a resident.
2. Register a center and delivery partner; approve them as administrator.
3. Create an available center that accepts a material category.
4. Schedule a resident pickup.
5. Claim the job as the approved delivery partner, then mark it collected and
   delivered.
6. Verify its received weight as the approved center and confirm the resident
   points ledger updates once.
7. Redeem an active coupon, update a complaint from the admin account, and check
   that the sender sees the new complaint status.

Use Vercel deployment logs for frontend issues, CloudWatch logs for Lambda
errors, and the DynamoDB console for stored records. Never paste access tokens
or secret values into shared logs or screenshots.

## 8. Redeploy and remove resources

Frontend changes deploy through the connected Vercel Git branch. Backend or
template changes deploy from `backend/` with:

```powershell
sam build
sam deploy
```

To remove the AWS stack, first back up any data you want to keep, then use
CloudFormation to delete the stack. DynamoDB deletion protection and the
template's retain policy mean the table may need a separate, deliberate
deletion step. Review all remaining AWS resources and billing after teardown.
