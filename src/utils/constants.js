export const ROLES = {
  USER: 'user',
  DELIVERY: 'delivery',
  CENTER: 'center',
  ADMIN: 'admin',
}

export const ROLE_OPTIONS = [
  { value: ROLES.USER, label: 'Resident' },
  { value: ROLES.DELIVERY, label: 'Delivery partner' },
  { value: ROLES.CENTER, label: 'Recycling center' },
  { value: ROLES.ADMIN, label: 'Administrator' },
]

export const ROLE_LABELS = Object.fromEntries(
  ROLE_OPTIONS.map(({ value, label }) => [value, label]),
)

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || 'Unknown role'
}

export const WASTE_CATEGORIES = [
  'Plastic',
  'Paper',
  'Glass',
  'Metal',
  'E-waste',
  'Organic',
  'Other',
]

export const VEHICLE_TYPES = [
  'Bicycle cart',
  'Motorcycle with crate',
  'Auto rickshaw',
  'Electric cargo van',
  'Mini truck',
]

export const PICKUP_STATUS = {
  REQUESTED: 'Requested',
  ACCEPTED: 'Accepted',
  PICKUP_SCHEDULED: 'Pickup Scheduled',
  COLLECTED: 'Collected',
  DELIVERED: 'Delivered to Center',
  VERIFIED: 'Recycling Verified',
  CANCELLED: 'Cancelled',
}

export const PICKUP_STATUS_ORDER = [
  PICKUP_STATUS.REQUESTED,
  PICKUP_STATUS.ACCEPTED,
  PICKUP_STATUS.PICKUP_SCHEDULED,
  PICKUP_STATUS.COLLECTED,
  PICKUP_STATUS.DELIVERED,
  PICKUP_STATUS.VERIFIED,
]

export const CANCELLABLE_STATUSES = [
  PICKUP_STATUS.REQUESTED,
  PICKUP_STATUS.ACCEPTED,
  PICKUP_STATUS.PICKUP_SCHEDULED,
]

export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
}

export const DEFAULT_POINTS_PER_KG = {
  Plastic: 20,
  Paper: 15,
  Glass: 18,
  Metal: 25,
  'E-waste': 30,
  Organic: 10,
  Other: 12,
}

export const DELIVERY_RATE_PER_KG = 6

export const DELIVERY_PAYMENT = {
  BASE_FEE: 20,
  DISTANCE_PER_KM: 5,
  VERIFIED_WEIGHT_PER_KG: 1,
  DAILY_FIVE_PICKUPS: 50,
  DAILY_TEN_PICKUPS: 120,
  HEAVY_LOAD_20_TO_40_KG: 15,
  HEAVY_LOAD_OVER_40_KG: 30,
  VERIFIED_RECYCLING: 10,
  MONTHLY_RELIABILITY: 100,
  RELIABILITY_MIN_PICKUPS: 10,
  RELIABILITY_ON_TIME_RATE: 0.95,
  ON_TIME_GRACE_MINUTES: 30,
}

export const VEHICLE_WEIGHT_LIMIT_KG = {
  'Bicycle cart': 25,
  'Motorcycle with crate': 40,
  'Auto rickshaw': 150,
  'Electric cargo van': 500,
  'Mini truck': 1000,
}

export const STORAGE_KEYS = {
  SESSION: 'revive_session_v2',
  DB: 'revive_db_v2',
}
