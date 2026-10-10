/**
 * Mock data layer — replace method implementations with API calls for AWS integration.
 */
import { createSeedDatabase, uid } from '../data/seedData'
import {
  ACCOUNT_STATUS,
  APPROVAL_STATUS,
  CANCELLABLE_STATUSES,
  PICKUP_STATUS,
  ROLES,
} from '../utils/constants'
import { clearAllReviveData, loadDatabase, saveDatabase } from './storage'

let listeners = new Set()

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  listeners.forEach((fn) => fn())
}

export function getDb() {
  let db = loadDatabase()
  if (!db) {
    db = createSeedDatabase()
    saveDatabase(db)
  }
  return db
}

export function persist(db) {
  saveDatabase(db)
  notify()
}

export function resetDemoData() {
  clearAllReviveData()
  const db = createSeedDatabase()
  saveDatabase(db)
  notify()
  return db
}

export function findUserById(id) {
  return getDb().users.find((u) => u.id === id) || null
}

export function findUserByEmail(email) {
  return getDb().users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
}

export function getUsers() {
  return getDb().users
}

export function getCenters() {
  return getDb().centers
}

export function getCenterById(id) {
  return getDb().centers.find((c) => c.id === id) || null
}

export function getCentersForCategory(category) {
  return getDb().centers.filter((c) => c.acceptedCategories.includes(category) && c.available)
}

export function getPickups() {
  return getDb().pickups
}

export function getPickupById(id) {
  return getDb().pickups.find((p) => p.id === id) || null
}

export function getUserPickups(userId) {
  return getDb().pickups.filter((p) => p.userId === userId)
}

export function getAvailableJobs() {
  return getDb().pickups.filter(
    (p) => p.status === PICKUP_STATUS.REQUESTED && !p.deliveryPartnerId,
  )
}

export function getDeliveryJobs(partnerId) {
  return getDb().pickups.filter((p) => p.deliveryPartnerId === partnerId)
}

export function getCenterPickups(centerId) {
  return getDb().pickups.filter((p) => p.centerId === centerId)
}

export function getCenterByOwnerUserId(userId) {
  const user = findUserById(userId)
  if (!user) return null
  return getDb().centers.find((c) => c.ownerUserId === userId) || null
}

export function resolveCenterIdForUser(centerUserId) {
  const owned = getCenterByOwnerUserId(centerUserId)
  if (owned) return owned.id
  if (centerUserId === 'ctr_demo_greenloop') return 'center_greenloop'
  return null
}

export function calculateEstimatedPoints(category, kg) {
  const rate = getDb().config.pointsPerKg[category] ?? 10
  return Math.round(Number(kg) * rate)
}

export function calculateVerifiedPoints(category, verifiedKg) {
  const rate = getDb().config.pointsPerKg[category] ?? 10
  return Math.round(Number(verifiedKg) * rate)
}

function pushTimeline(pickup, status, note) {
  pickup.timeline = pickup.timeline || []
  pickup.timeline.push({ status, at: new Date().toISOString(), note })
}

export function createPickupRequest(payload) {
  const db = getDb()
  const user = findUserById(payload.userId)
  if (!user || user.status === ACCOUNT_STATUS.SUSPENDED) {
    return { ok: false, error: 'Account cannot create pickups.' }
  }
  const center = getCenterById(payload.centerId)
  const id = uid('pick')
  const pickup = {
    id,
    userId: user.id,
    userName: user.name,
    wasteCategory: payload.wasteCategory,
    quantityKg: Number(payload.quantityKg),
    verifiedWeightKg: null,
    pickupAddress: payload.pickupAddress,
    scheduledAt: payload.scheduledAt,
    instructions: payload.instructions || '',
    centerId: center?.id || payload.centerId,
    centerName: center?.name || payload.centerName,
    deliveryPartnerId: null,
    deliveryPartnerName: null,
    status: PICKUP_STATUS.REQUESTED,
    pointsAwarded: 0,
    pointsAwardedAt: null,
    timeline: [{ status: PICKUP_STATUS.REQUESTED, at: new Date().toISOString(), note: 'Pickup requested' }],
    createdAt: new Date().toISOString(),
  }
  db.pickups.unshift(pickup)
  persist(db)
  return { ok: true, pickup }
}

export function cancelPickup(pickupId, userId) {
  const db = getDb()
  const pickup = db.pickups.find((p) => p.id === pickupId)
  if (!pickup || pickup.userId !== userId) return { ok: false, error: 'Pickup not found.' }
  if (!CANCELLABLE_STATUSES.includes(pickup.status)) {
    return { ok: false, error: 'This pickup can no longer be cancelled.' }
  }
  pickup.status = PICKUP_STATUS.CANCELLED
  pushTimeline(pickup, PICKUP_STATUS.CANCELLED, 'Cancelled by user')
  persist(db)
  return { ok: true }
}

export function acceptPickupJob(pickupId, partnerId) {
  const db = getDb()
  const partner = findUserById(partnerId)
  if (!partner || partner.role !== ROLES.DELIVERY) return { ok: false, error: 'Invalid partner.' }
  if (partner.approvalStatus !== APPROVAL_STATUS.APPROVED || partner.status === ACCOUNT_STATUS.SUSPENDED) {
    return { ok: false, error: 'Partner account is not approved or is suspended.' }
  }
  const pickup = db.pickups.find((p) => p.id === pickupId)
  if (!pickup || pickup.status !== PICKUP_STATUS.REQUESTED || pickup.deliveryPartnerId) {
    return { ok: false, error: 'Job is no longer available.' }
  }
  pickup.deliveryPartnerId = partner.id
  pickup.deliveryPartnerName = partner.name
  pickup.status = PICKUP_STATUS.ACCEPTED
  pushTimeline(pickup, PICKUP_STATUS.ACCEPTED, `Accepted by ${partner.name}`)
  pickup.status = PICKUP_STATUS.PICKUP_SCHEDULED
  pushTimeline(pickup, PICKUP_STATUS.PICKUP_SCHEDULED, 'Pickup scheduled with resident')
  persist(db)
  return { ok: true, pickup }
}

const DELIVERY_TRANSITIONS = {
  [PICKUP_STATUS.PICKUP_SCHEDULED]: PICKUP_STATUS.COLLECTED,
  [PICKUP_STATUS.COLLECTED]: PICKUP_STATUS.DELIVERED,
}

export function updateDeliveryJobStatus(pickupId, partnerId, nextStatus) {
  const db = getDb()
  const pickup = db.pickups.find((p) => p.id === pickupId)
  if (!pickup || pickup.deliveryPartnerId !== partnerId) {
    return { ok: false, error: 'Job not found.' }
  }
  if (nextStatus === PICKUP_STATUS.VERIFIED) {
    return { ok: false, error: 'Delivery partners cannot verify recycling.' }
  }
  const expected = DELIVERY_TRANSITIONS[pickup.status]
  if (nextStatus !== expected) {
    return { ok: false, error: `Invalid transition from ${pickup.status}.` }
  }
  pickup.status = nextStatus
  const note =
    nextStatus === PICKUP_STATUS.COLLECTED
      ? 'Waste collected from resident'
      : 'Delivered to recycling center'
  pushTimeline(pickup, nextStatus, note)
  persist(db)
  return { ok: true, pickup }
}

export function centerConfirmReceived(pickupId, centerUserId, verifiedWeightKg) {
  const db = getDb()
  const centerId = resolveCenterIdForUser(centerUserId)
  const pickup = db.pickups.find((p) => p.id === pickupId)
  if (!pickup || pickup.centerId !== centerId) {
    return { ok: false, error: 'Request not assigned to your center.' }
  }
  if (pickup.status !== PICKUP_STATUS.DELIVERED) {
    return { ok: false, error: 'Waste must be delivered before confirming quantity.' }
  }
  pickup.verifiedWeightKg = Number(verifiedWeightKg)
  pushTimeline(pickup, pickup.status, `Received ${verifiedWeightKg} kg at center`)
  persist(db)
  return { ok: true, pickup }
}

export function verifyRecycling(pickupId, actorUserId, actorRole, note) {
  const db = getDb()
  const pickup = db.pickups.find((p) => p.id === pickupId)
  if (!pickup) return { ok: false, error: 'Pickup not found.' }

  if (actorRole === ROLES.CENTER) {
    const centerId = resolveCenterIdForUser(actorUserId)
    if (pickup.centerId !== centerId) {
      return { ok: false, error: 'You are not authorized to verify this request.' }
    }
    const centerUser = findUserById(actorUserId)
    if (centerUser?.approvalStatus !== APPROVAL_STATUS.APPROVED) {
      return { ok: false, error: 'Center not approved.' }
    }
  } else if (actorRole !== ROLES.ADMIN) {
    return { ok: false, error: 'Not authorized to verify.' }
  }

  if (pickup.status === PICKUP_STATUS.VERIFIED && pickup.pointsAwarded > 0) {
    return { ok: false, error: 'Already verified — duplicate rewards prevented.' }
  }
  if (pickup.status === PICKUP_STATUS.CANCELLED) {
    return { ok: false, error: 'Cancelled pickups cannot be verified.' }
  }
  if (pickup.status !== PICKUP_STATUS.DELIVERED) {
    return { ok: false, error: 'Complete delivery before verification.' }
  }
  if (pickup.verifiedWeightKg == null) {
    return { ok: false, error: 'Confirm received quantity before verifying.' }
  }

  const weight = pickup.verifiedWeightKg ?? pickup.quantityKg
  pickup.verifiedWeightKg = weight
  pickup.status = PICKUP_STATUS.VERIFIED

  if (!pickup.pointsAwarded || pickup.pointsAwarded === 0) {
    const points = calculateVerifiedPoints(pickup.wasteCategory, weight)
    pickup.pointsAwarded = points
    pickup.pointsAwardedAt = new Date().toISOString()
    const user = db.users.find((u) => u.id === pickup.userId)
    if (user) user.points = (user.points || 0) + points
    db.rewardTransactions.unshift({
      id: uid('rtx'),
      userId: pickup.userId,
      type: 'earn',
      amount: points,
      description: `Recycling verified — ${pickup.id}`,
      pickupId: pickup.id,
      createdAt: new Date().toISOString(),
    })
  }

  pushTimeline(pickup, PICKUP_STATUS.VERIFIED, note || 'Recycling verified — reward points credited')
  persist(db)
  return { ok: true, pickup }
}

export function registerUser(payload) {
  const db = getDb()
  if (findUserByEmail(payload.email)) {
    return { ok: false, error: 'An account with this email already exists.' }
  }
  const id = uid('usr')
  const user = {
    id,
    role: ROLES.USER,
    email: payload.email.trim(),
    password: payload.password,
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    city: payload.city.trim(),
    address: payload.address.trim(),
    status: ACCOUNT_STATUS.ACTIVE,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    points: 0,
    createdAt: new Date().toISOString(),
  }
  db.users.push(user)
  persist(db)
  return { ok: true, user }
}

export function registerDelivery(payload) {
  const db = getDb()
  if (findUserByEmail(payload.email)) {
    return { ok: false, error: 'An account with this email already exists.' }
  }
  const user = {
    id: uid('dlv'),
    role: ROLES.DELIVERY,
    email: payload.email.trim(),
    password: payload.password,
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    city: payload.city.trim(),
    serviceArea: payload.serviceArea.trim(),
    vehicleType: payload.vehicleType.trim(),
    vehicleReg: payload.vehicleReg.trim(),
    identityVerified: false,
    status: ACCOUNT_STATUS.ACTIVE,
    approvalStatus: APPROVAL_STATUS.PENDING,
    points: 0,
    createdAt: new Date().toISOString(),
  }
  db.users.push(user)
  persist(db)
  return { ok: true, user }
}

export function registerCenter(payload) {
  const db = getDb()
  if (findUserByEmail(payload.email)) {
    return { ok: false, error: 'An account with this email already exists.' }
  }
  const userId = uid('ctr')
  const user = {
    id: userId,
    role: ROLES.CENTER,
    email: payload.email.trim(),
    password: payload.password,
    name: payload.centerName.trim(),
    contactPerson: payload.contactPerson.trim(),
    phone: payload.phone.trim(),
    city: payload.city.trim(),
    address: payload.address.trim(),
    acceptedCategories: payload.acceptedCategories,
    operatingHours: payload.operatingHours.trim(),
    description: payload.description.trim(),
    businessVerified: false,
    status: ACCOUNT_STATUS.ACTIVE,
    approvalStatus: APPROVAL_STATUS.PENDING,
    rating: 0,
    points: 0,
    createdAt: new Date().toISOString(),
  }
  db.users.push(user)
  db.centers.push({
    id: uid('center'),
    ownerUserId: userId,
    name: user.name,
    city: user.city,
    address: user.address,
    acceptedCategories: [...payload.acceptedCategories],
    operatingHours: user.operatingHours,
    rating: 0,
    available: false,
    description: user.description,
  })
  persist(db)
  return { ok: true, user }
}

export function authenticate(email, password, expectedRole) {
  const user = findUserByEmail(email)
  if (!user || user.password !== password) {
    return { ok: false, error: 'Invalid email or password.' }
  }
  if (expectedRole && user.role !== expectedRole) {
    return { ok: false, error: 'This login is not valid for that account type.' }
  }
  if (user.status === ACCOUNT_STATUS.SUSPENDED) {
    return { ok: false, error: 'This account has been suspended. Contact support.' }
  }
  return {
    ok: true,
    session: { userId: user.id, email: user.email, role: user.role, name: user.name },
  }
}

export function updateUserProfile(userId, patch) {
  const db = getDb()
  const user = db.users.find((u) => u.id === userId)
  if (!user) return { ok: false, error: 'User not found.' }
  Object.assign(user, patch)
  if (user.role === ROLES.CENTER) {
    const center = db.centers.find((c) => c.ownerUserId === userId)
    if (center) {
      center.name = user.name
      center.address = user.address
      center.city = user.city
      center.acceptedCategories = user.acceptedCategories || center.acceptedCategories
      center.operatingHours = user.operatingHours || center.operatingHours
      center.description = user.description || center.description
    }
  }
  persist(db)
  return { ok: true, user }
}

export function setApprovalStatus(userId, status) {
  const db = getDb()
  const user = db.users.find((u) => u.id === userId)
  if (!user) return { ok: false, error: 'User not found.' }
  user.approvalStatus = status
  if (user.role === ROLES.CENTER) {
    const center = db.centers.find((c) => c.ownerUserId === userId)
    if (center) center.available = status === APPROVAL_STATUS.APPROVED
  }
  persist(db)
  return { ok: true, user }
}

export function setAccountStatus(userId, status) {
  const db = getDb()
  const user = db.users.find((u) => u.id === userId)
  if (!user) return { ok: false, error: 'User not found.' }
  user.status = status
  persist(db)
  return { ok: true, user }
}

export function updatePointsConfig(pointsPerKg) {
  const db = getDb()
  db.config.pointsPerKg = { ...db.config.pointsPerKg, ...pointsPerKg }
  persist(db)
  return { ok: true }
}

export function redeemCoupon(userId, couponId) {
  const db = getDb()
  const user = db.users.find((u) => u.id === userId)
  const coupon = db.coupons.find((c) => c.id === couponId)
  if (!user || !coupon) return { ok: false, error: 'Invalid redemption.' }
  if ((user.points || 0) < coupon.pointsCost) {
    return { ok: false, error: 'Insufficient points balance.' }
  }
  user.points -= coupon.pointsCost
  db.rewardTransactions.unshift({
    id: uid('rtx'),
    userId,
    type: 'redeem',
    amount: -coupon.pointsCost,
    description: `Redeemed: ${coupon.title} (simulated)`,
    couponId: coupon.id,
    createdAt: new Date().toISOString(),
  })
  persist(db)
  return { ok: true, balance: user.points }
}

export function getCoupons() {
  return getDb().coupons
}

export function getRewardTransactions(userId) {
  return getDb().rewardTransactions.filter((t) => t.userId === userId)
}

export function getAllRewardTransactions() {
  const db = getDb()
  return db.rewardTransactions.map((t) => ({
    ...t,
    userName: db.users.find((u) => u.id === t.userId)?.name || 'Unknown',
  }))
}

export function getComplaints() {
  return getDb().complaints
}

export function resolveComplaint(id) {
  const db = getDb()
  const complaint = db.complaints.find((c) => c.id === id)
  if (!complaint) return { ok: false, error: 'Complaint not found.' }
  complaint.status = complaint.status === 'resolved' ? 'open' : 'resolved'
  persist(db)
  return { ok: true, complaint }
}

export function getCategoryBreakdown() {
  const db = getDb()
  const totals = {}
  db.pickups
    .filter((p) => p.status === PICKUP_STATUS.VERIFIED)
    .forEach((p) => {
      const kg = p.verifiedWeightKg ?? p.quantityKg
      totals[p.wasteCategory] = (totals[p.wasteCategory] || 0) + kg
    })
  return Object.entries(totals).map(([category, kg]) => ({ category, kg: Math.round(kg * 10) / 10 }))
}

export function getWeeklyActivity(userId) {
  const db = getDb()
  const days = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: 'short' }), kg: 0 })
  }
  db.pickups
    .filter((p) => (userId ? p.userId === userId : true))
    .filter((p) => [PICKUP_STATUS.VERIFIED, PICKUP_STATUS.DELIVERED, PICKUP_STATUS.COLLECTED].includes(p.status))
    .forEach((p) => {
      const key = new Date(p.scheduledAt || p.createdAt).toDateString()
      const bucket = days.find((d) => d.key === key)
      if (bucket) bucket.kg += p.verifiedWeightKg ?? p.quantityKg
    })
  return days.map((d) => ({ day: d.label, kg: Math.round(d.kg * 10) / 10 }))
}

export function getCenterInventory(centerId) {
  const db = getDb()
  const verified = db.pickups.filter((p) => p.centerId === centerId && p.status === PICKUP_STATUS.VERIFIED)
  const totals = {}
  verified.forEach((p) => {
    const kg = p.verifiedWeightKg ?? p.quantityKg
    totals[p.wasteCategory] = (totals[p.wasteCategory] || 0) + kg
  })
  return {
    records: verified.sort((a, b) => new Date(b.pointsAwardedAt) - new Date(a.pointsAwardedAt)),
    totals: Object.entries(totals).map(([category, kg]) => ({ category, kg: Math.round(kg * 10) / 10 })),
    totalKg: Math.round(verified.reduce((s, p) => s + (p.verifiedWeightKg ?? p.quantityKg), 0) * 10) / 10,
  }
}

export function getAdminMetrics() {
  const db = getDb()
  const users = db.users.filter((u) => u.role === ROLES.USER)
  const delivery = db.users.filter((u) => u.role === ROLES.DELIVERY && u.approvalStatus === APPROVAL_STATUS.APPROVED)
  const centers = db.users.filter((u) => u.role === ROLES.CENTER && u.approvalStatus === APPROVAL_STATUS.APPROVED)
  const verified = db.pickups.filter((p) => p.status === PICKUP_STATUS.VERIFIED)
  const totalKg = verified.reduce((s, p) => s + (p.verifiedWeightKg || p.quantityKg), 0)
  const today = new Date().toDateString()
  return {
    totalUsers: users.length,
    activeDelivery: delivery.length,
    approvedCenters: centers.length,
    totalWasteKg: Math.round(totalKg * 10) / 10,
    receivedToday: db.pickups.filter(
      (p) => [PICKUP_STATUS.DELIVERED, PICKUP_STATUS.VERIFIED].includes(p.status) && new Date(p.scheduledAt || p.createdAt).toDateString() === today,
    ).length,
    pendingDeliveryApps: db.users.filter(
      (u) => u.role === ROLES.DELIVERY && u.approvalStatus === APPROVAL_STATUS.PENDING,
    ).length,
    pendingCenterApps: db.users.filter(
      (u) => u.role === ROLES.CENTER && u.approvalStatus === APPROVAL_STATUS.PENDING,
    ).length,
    pendingVerification: db.pickups.filter(
      (p) => p.status === PICKUP_STATUS.DELIVERED,
    ).length,
    pointsIssued: db.rewardTransactions.filter((t) => t.type === 'earn').reduce((s, t) => s + t.amount, 0),
  }
}
