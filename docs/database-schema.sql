-- ReVive relational schema (PostgreSQL 15+)
-- Authentication secrets are owned by the identity provider; never store plaintext passwords here.

CREATE TYPE account_role AS ENUM ('user', 'delivery', 'center', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'suspended');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE pickup_status AS ENUM (
  'Requested', 'Accepted', 'Pickup Scheduled', 'Collected',
  'Delivered to Center', 'Recycling Verified', 'Cancelled'
);
CREATE TYPE reward_transaction_type AS ENUM ('earn', 'redeem', 'adjustment');
CREATE TYPE complaint_status AS ENUM ('open', 'resolved');

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_subject text UNIQUE, -- Cognito/OIDC subject; null until linked
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  role account_role NOT NULL,
  status account_status NOT NULL DEFAULT 'active',
  approval_status approval_status NOT NULL DEFAULT 'approved',
  name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_normalized),
  CHECK (role IN ('delivery', 'center') OR approval_status = 'approved')
);

CREATE TABLE resident_profiles (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  city text NOT NULL,
  address text NOT NULL
);

CREATE TABLE delivery_profiles (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  city text NOT NULL,
  service_area text NOT NULL,
  vehicle_type text NOT NULL,
  vehicle_registration text NOT NULL,
  identity_verified boolean NOT NULL DEFAULT false,
  UNIQUE (vehicle_registration)
);

CREATE TABLE recycling_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id uuid NOT NULL UNIQUE REFERENCES accounts(id),
  name text NOT NULL,
  contact_person text,
  phone text,
  city text NOT NULL,
  address text NOT NULL,
  operating_hours text,
  description text,
  business_verified boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT false,
  rating numeric(2,1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE waste_categories (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE center_accepted_categories (
  center_id uuid NOT NULL REFERENCES recycling_centers(id) ON DELETE CASCADE,
  category_id smallint NOT NULL REFERENCES waste_categories(id),
  PRIMARY KEY (center_id, category_id)
);

CREATE TABLE pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES accounts(id),
  center_id uuid NOT NULL REFERENCES recycling_centers(id),
  delivery_partner_id uuid REFERENCES accounts(id),
  category_id smallint NOT NULL REFERENCES waste_categories(id),
  quantity_kg numeric(10,2) NOT NULL CHECK (quantity_kg > 0),
  verified_weight_kg numeric(10,2) CHECK (verified_weight_kg > 0),
  pickup_address text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  instructions text NOT NULL DEFAULT '',
  status pickup_status NOT NULL DEFAULT 'Requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (verified_weight_kg IS NULL OR status IN ('Delivered to Center', 'Recycling Verified'))
);

CREATE TABLE pickup_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pickup_id uuid NOT NULL REFERENCES pickups(id) ON DELETE CASCADE,
  status pickup_status NOT NULL,
  actor_account_id uuid REFERENCES accounts(id),
  note text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE points_rates (
  category_id smallint PRIMARY KEY REFERENCES waste_categories(id),
  points_per_kg numeric(10,2) NOT NULL CHECK (points_per_kg >= 0),
  updated_by uuid REFERENCES accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  partner text NOT NULL,
  points_cost integer NOT NULL CHECK (points_cost > 0),
  category text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Immutable ledger. Balance is SUM(amount); positive earns, negative redemptions.
-- The ledger is the sole source of truth for awarded point amounts.
-- A database transaction must insert a redemption only when the resulting balance is sufficient.
CREATE TABLE reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  type reward_transaction_type NOT NULL,
  amount integer NOT NULL CHECK (amount <> 0),
  description text NOT NULL,
  pickup_id uuid REFERENCES pickups(id),
  coupon_id uuid REFERENCES coupons(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((type = 'earn' AND amount > 0 AND pickup_id IS NOT NULL AND coupon_id IS NULL)
      OR (type = 'redeem' AND amount < 0 AND coupon_id IS NOT NULL AND pickup_id IS NULL)
      OR type = 'adjustment')
);
CREATE UNIQUE INDEX reward_once_per_pickup ON reward_transactions(pickup_id) WHERE type = 'earn';

CREATE TABLE complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  pickup_id uuid REFERENCES pickups(id),
  subject text NOT NULL,
  details text NOT NULL DEFAULT '',
  status complaint_status NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES accounts(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);

CREATE INDEX pickups_resident_created ON pickups(resident_id, created_at DESC);
CREATE INDEX pickups_center_status ON pickups(center_id, status, scheduled_at);
CREATE INDEX pickups_partner_status ON pickups(delivery_partner_id, status, scheduled_at);
CREATE INDEX pickups_available_jobs ON pickups(status, scheduled_at) WHERE delivery_partner_id IS NULL;
CREATE INDEX pickup_events_history ON pickup_events(pickup_id, occurred_at);
CREATE INDEX reward_account_history ON reward_transactions(account_id, created_at DESC);
CREATE INDEX complaints_status_created ON complaints(status, created_at DESC);

-- Seed waste_categories with the app's categories: Plastic, Paper, Glass, Metal,
-- E-waste, Organic, Other. Store IDs and corresponding point rates in points_rates.
-- Use transactions for state transitions, verification + ledger credit, and redemption.
