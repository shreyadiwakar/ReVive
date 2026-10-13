-- ReVive hosted database for the Vercel deployment.
-- Run this once in the Supabase SQL editor for a new project.
create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('user', 'delivery', 'center', 'admin')),
  name text not null,
  phone text not null default '',
  address text not null default '',
  city text not null default '',
  status text not null default 'active' check (status in ('active', 'suspended')),
  approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'rejected')),
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.centers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.accounts(id) on delete cascade,
  name text not null,
  contact_person text not null default '',
  phone text not null default '',
  city text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  accepted_categories text[] not null default '{}',
  operating_hours text not null default '',
  description text not null default '',
  available boolean not null default false,
  business_verified boolean not null default false,
  rating numeric(2,1) not null default 0,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.pickups (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.accounts(id),
  center_id uuid not null references public.centers(id),
  delivery_partner_id uuid references public.accounts(id),
  waste_category text not null,
  quantity_kg numeric(10,2) not null check (quantity_kg > 0),
  verified_weight_kg numeric(10,2),
  pickup_address text not null,
  pickup_latitude double precision,
  pickup_longitude double precision,
  scheduled_at timestamptz not null,
  instructions text not null default '',
  status text not null default 'Requested',
  points_awarded integer not null default 0,
  points_awarded_at timestamptz,
  earning_distance_km numeric(10,2),
  earning_distance_method text,
  earning_distance_captured_at timestamptz,
  vehicle_weight_limit_kg numeric(10,2),
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.points_rates (
  category text primary key,
  points_per_kg numeric(10,2) not null check (points_per_kg >= 0)
);

insert into public.points_rates(category, points_per_kg) values
  ('Plastic',20),('Paper',15),('Glass',18),('Metal',25),('E-waste',30),('Organic',10),('Other',12)
on conflict (category) do nothing;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  partner text not null,
  points_cost integer not null check (points_cost > 0),
  category text not null default 'Grocery',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.accounts(id),
  type text not null check (type in ('earn','redeem','adjustment')),
  amount integer not null check (amount <> 0),
  description text not null,
  pickup_id uuid references public.pickups(id),
  coupon_id uuid references public.coupons(id),
  created_at timestamptz not null default now(),
  unique (pickup_id, type)
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id),
  pickup_id uuid references public.pickups(id),
  subject text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open','resolved')),
  resolved_by uuid references public.accounts(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pickups_resident_created on public.pickups(resident_id, created_at desc);
create index if not exists pickups_center_schedule on public.pickups(center_id, scheduled_at);
create index if not exists pickups_partner_schedule on public.pickups(delivery_partner_id, scheduled_at);
create index if not exists reward_resident_history on public.reward_transactions(resident_id, created_at desc);
create index if not exists complaint_account_history on public.complaints(account_id, created_at desc);

-- API access uses the service role only from Vercel functions. Keep browser roles
-- locked out of these tables; never put SUPABASE_SERVICE_ROLE_KEY in VITE_* vars.
alter table public.accounts enable row level security;
alter table public.centers enable row level security;
alter table public.pickups enable row level security;
alter table public.points_rates enable row level security;
alter table public.coupons enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.complaints enable row level security;

create or replace function public.revive_redeem(p_resident_id uuid, p_coupon_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.coupons%rowtype; balance_now integer; tx public.reward_transactions%rowtype;
begin
  select * into c from public.coupons where id = p_coupon_id and active = true for update;
  if not found then raise exception 'This reward is no longer available.' using errcode = 'P0001'; end if;
  select coalesce(sum(amount),0)::integer into balance_now
    from public.reward_transactions where resident_id = p_resident_id;
  if balance_now < c.points_cost then raise exception 'You do not have enough points for this reward.' using errcode = 'P0001'; end if;
  insert into public.reward_transactions(resident_id,type,amount,description,coupon_id)
    values(p_resident_id,'redeem',-c.points_cost,'Redeemed ' || c.title,c.id) returning * into tx;
  return jsonb_build_object('transaction',to_jsonb(tx),'balance',balance_now-c.points_cost);
end $$;

create or replace function public.revive_verify_pickup(
  p_pickup_id uuid, p_center_owner uuid, p_weight numeric, p_note text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.pickups%rowtype; rate numeric; points integer; tx public.reward_transactions%rowtype; now_at timestamptz := now();
begin
  select pk.* into p from public.pickups pk join public.centers c on c.id=pk.center_id
    where pk.id=p_pickup_id and c.owner_id=p_center_owner and c.approval_status='approved' for update;
  if not found then raise exception 'Pickup not found for this recycling center.' using errcode='P0001'; end if;
  if p.status <> 'Delivered to Center' then raise exception 'Only delivered pickups can be verified.' using errcode='P0001'; end if;
  if p_weight <= 0 or p_weight > 10000 then raise exception 'Enter a valid received weight.' using errcode='P0001'; end if;
  select points_per_kg into rate from public.points_rates where category=p.waste_category;
  points := round(p_weight * coalesce(rate,12));
  update public.pickups set status='Recycling Verified', verified_weight_kg=p_weight, points_awarded=points,
    points_awarded_at=now_at, updated_at=now_at,
    timeline=timeline || jsonb_build_array(jsonb_build_object('status','Recycling Verified','at',now_at,'note',coalesce(p_note,'')))
    where id=p.id returning * into p;
  if points > 0 then
    insert into public.reward_transactions(resident_id,type,amount,description,pickup_id)
      values(p.resident_id,'earn',points,'Recycling verified: '||p.waste_category,p.id) returning * into tx;
  end if;
  return jsonb_build_object('pickup',to_jsonb(p),'reward',jsonb_build_object('pointsAwarded',points));
end $$;

create or replace function public.revive_claim_pickup(p_pickup_id uuid, p_partner_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.pickups%rowtype; now_at timestamptz := now();
begin
  select * into p from public.pickups where id=p_pickup_id for update;
  if not found or p.status <> 'Requested' or p.delivery_partner_id is not null then
    raise exception 'This pickup has already been assigned.' using errcode='P0001';
  end if;
  update public.pickups set delivery_partner_id=p_partner_id,status='Pickup Scheduled',updated_at=now_at,
    timeline=timeline || jsonb_build_array(
      jsonb_build_object('status','Accepted','at',now_at,'note','Accepted by delivery partner'),
      jsonb_build_object('status','Pickup Scheduled','at',now_at,'note','Pickup scheduled'))
    where id=p.id returning * into p;
  return to_jsonb(p);
end $$;

create or replace function public.revive_set_pickup_status(p_pickup_id uuid, p_partner_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.pickups%rowtype; now_at timestamptz := now();
begin
  if p_status not in ('Collected','Delivered to Center') then raise exception 'Invalid pickup status.' using errcode='P0001'; end if;
  update public.pickups set status=p_status,updated_at=now_at,
    timeline=timeline || jsonb_build_array(jsonb_build_object('status',p_status,'at',now_at,'note','Updated by delivery partner'))
    where id=p_pickup_id and delivery_partner_id=p_partner_id and
      ((p_status='Collected' and status='Pickup Scheduled') or (p_status='Delivered to Center' and status='Collected'))
    returning * into p;
  if not found then raise exception 'Pickup status cannot be changed to that value.' using errcode='P0001'; end if;
  return to_jsonb(p);
end $$;

revoke all on function public.revive_redeem(uuid,uuid) from public, anon, authenticated;
revoke all on function public.revive_verify_pickup(uuid,uuid,numeric,text) from public, anon, authenticated;
revoke all on function public.revive_claim_pickup(uuid,uuid) from public, anon, authenticated;
revoke all on function public.revive_set_pickup_status(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.revive_redeem(uuid,uuid) to service_role;
grant execute on function public.revive_verify_pickup(uuid,uuid,numeric,text) to service_role;
grant execute on function public.revive_claim_pickup(uuid,uuid) to service_role;
grant execute on function public.revive_set_pickup_status(uuid,uuid,text) to service_role;
