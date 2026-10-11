# ReVive DynamoDB design

The backend starter uses one DynamoDB table with `PK` and `SK` as its primary
key and three GSIs. Items use sparse GSI attributes: they appear in an index
only when those attributes are present. This supports the app's core query
patterns without scanning the whole table.

| Data / access pattern | Primary key | Index key |
|---|---|---|
| Account profile by id | `ACCOUNT#<id>` / `PROFILE` | — |
| Find account by normalized email | account item | GSI1: `EMAIL#<email>` / `ACCOUNT#<id>` |
| Center profile / owner lookup | `CENTER#<id>` / `PROFILE` | GSI1: `OWNER#<accountId>` / `CENTER#<id>` |
| Available center directory | center profile | GSI2: `AVAILABLE_CENTERS` / `CITY#<city>#CENTER#<id>` |
| Pickup detail | `PICKUP#<id>` / `META` | — |
| Pickup status timeline | `PICKUP#<id>` / `EVENT#<time>#<eventId>` | — |
| Resident pickup list | pickup item | GSI1: `RESIDENT#<id>` / `PICKUP#<createdAt>#<id>` |
| Partner's assigned work or available jobs | pickup item | GSI2: `PARTNER#<id>` or `OPEN_PICKUPS` / `<scheduledAt>#<id>` |
| Center's pickup queue | pickup item | GSI3: `CENTER#<id>` / `<scheduledAt>#<id>` |
| Reward ledger and balance item | `ACCOUNT#<id>` / `REWARD#<time>#<id>` or `POINTS#BALANCE` | — |
| Coupon detail | `COUPON#<id>` / `META` | — |
| Complaint detail / status queue | `COMPLAINT#<id>` / `META` | GSI2: `COMPLAINTS#<status>` / `<createdAt>#<id>` |
| Points rate by waste category | `CONFIG#POINTS` / `CATEGORY#<name>` | — |

Because GSI2 serves available centers, partner jobs, and complaint queues,
those item types use different partition key prefixes. A GSI only returns
items that carry its partition and sort key attributes. Unavailable centers
omit the directory index attributes.

For a pickup workflow operation, update the pickup and append its event in one
`TransactWriteItems` call, with a condition on the expected current status.
Partner acceptance conditionally changes the pickup from `OPEN_PICKUPS` to
`PARTNER#<id>` in GSI2, preventing two partners from claiming the same job.
Verification changes the pickup only from Delivered to Center with zero points
awarded. In that same transaction, append a unique reward ledger entry, add to
the resident's `POINTS#BALANCE` item, and append the timeline event. This status
condition prevents duplicate awards; the ledger remains authoritative and the
balance is its transactionally maintained projection. Redemptions must use a
conditional balance update to prevent concurrent overspending.
Verification reads the category rate from `CONFIG#POINTS` / `CATEGORY#<name>`;
if no config item exists, it uses the starter rates documented in the API contract.

For the local runner only, resident sign-up also writes a
`LOCAL_EMAIL#<email>` / `UNIQUE` item that stores the account id and a salted
scrypt password hash.
The local runner reads it consistently for login. This local authentication
path is not enabled by the deployed Lambda; deployed signup and login continue
to use Cognito. Account profile items use the documented `ACCOUNT#<id>` /
`PROFILE` key and GSI1 email keys.

The SQL file at `docs/database-schema.sql` is a PostgreSQL reference from the
earlier design; it is not used by this DynamoDB backend.
