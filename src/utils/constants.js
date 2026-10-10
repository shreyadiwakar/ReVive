export const ROLES = {
  USER: 'user',
  DELIVERY: 'delivery',
  CENTER: 'center',
  ADMIN: 'admin',
}

export const ROLE_LABELS = {
  [ROLES.USER]: 'Resident',
  [ROLES.DELIVERY]: 'Delivery partner',
  [ROLES.CENTER]: 'Recycling center',
  [ROLES.ADMIN]: 'Administrator',
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

export const STORAGE_KEYS = {
  SESSION: 'revive_session_v2',
  DB: 'revive_db_v2',
}
