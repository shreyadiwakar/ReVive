import { DELIVERY_PAYMENT, PICKUP_STATUS } from '../utils/constants'

const verifiedAt = (pickup) => pickup.pointsAwardedAt || pickup.updatedAt || pickup.createdAt
function indiaDateKey(value, includeDay) {
  if (!value || !Number.isFinite(Date.parse(value))) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', ...(includeDay ? { day: '2-digit' } : {}),
  }).formatToParts(new Date(value))
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return includeDay ? `${fields.year}-${fields.month}-${fields.day}` : `${fields.year}-${fields.month}`
}
const indiaDay = (pickup) => indiaDateKey(verifiedAt(pickup), true)
const indiaMonth = (pickup) => indiaDateKey(verifiedAt(pickup), false)

export function calculateDeliveryEarnings(pickups) {
  const eligible = [...new Map(pickups
    .filter((pickup) => pickup.status === PICKUP_STATUS.VERIFIED && pickup.deliveryPartnerId)
    .map((pickup) => [pickup.id, pickup])).values()]
    .sort((a, b) => new Date(verifiedAt(a)) - new Date(verifiedAt(b)) || a.id.localeCompare(b.id))

  const byDay = new Map()
  const byMonth = new Map()
  for (const pickup of eligible) {
    const day = indiaDay(pickup)
    const month = indiaMonth(pickup)
    if (day) byDay.set(day, [...(byDay.get(day) || []), pickup])
    if (month) byMonth.set(month, [...(byMonth.get(month) || []), pickup])
  }

  const dailyBonusByPickup = new Map()
  for (const group of byDay.values()) {
    if (group.length >= 10) dailyBonusByPickup.set(group[9].id, DELIVERY_PAYMENT.DAILY_TEN_PICKUPS)
    else if (group.length >= 5) dailyBonusByPickup.set(group[4].id, DELIVERY_PAYMENT.DAILY_FIVE_PICKUPS)
  }

  const reliabilityBonusByPickup = new Map()
  for (const group of byMonth.values()) {
    if (group.length < DELIVERY_PAYMENT.RELIABILITY_MIN_PICKUPS) continue
    const onTime = group.filter((pickup) => {
      const collectedAt = Date.parse(pickup.collectedAt || '')
      const scheduledAt = Date.parse(pickup.scheduledAt || '')
      return Number.isFinite(collectedAt) && Number.isFinite(scheduledAt)
        && collectedAt <= scheduledAt + DELIVERY_PAYMENT.ON_TIME_GRACE_MINUTES * 60_000
    }).length
    if (onTime / group.length >= DELIVERY_PAYMENT.RELIABILITY_ON_TIME_RATE) {
      reliabilityBonusByPickup.set(group[group.length - 1].id, DELIVERY_PAYMENT.MONTHLY_RELIABILITY)
    }
  }

  const breakdowns = eligible.map((pickup) => {
    const weightKg = Number(pickup.verifiedWeightKg)
    const distanceKm = pickup.earningDistanceKm == null || pickup.earningDistanceKm === ''
      ? Number.NaN : Number(pickup.earningDistanceKm)
    const heavyLoadBonus = weightKg > 40
      ? DELIVERY_PAYMENT.HEAVY_LOAD_OVER_40_KG
      : weightKg >= 20 ? DELIVERY_PAYMENT.HEAVY_LOAD_20_TO_40_KG : 0
    const amount = (value) => Math.round(value * 100) / 100
    const breakdown = {
      pickupId: pickup.id,
      verifiedAt: verifiedAt(pickup),
      weightKg,
      distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
      baseFee: DELIVERY_PAYMENT.BASE_FEE,
      distanceAllowance: Number.isFinite(distanceKm) ? amount(distanceKm * DELIVERY_PAYMENT.DISTANCE_PER_KM) : 0,
      weightAllowance: Number.isFinite(weightKg) ? amount(weightKg * DELIVERY_PAYMENT.VERIFIED_WEIGHT_PER_KG) : 0,
      heavyLoadBonus,
      verifiedRecyclingBonus: DELIVERY_PAYMENT.VERIFIED_RECYCLING,
      pickupCompletionBonus: dailyBonusByPickup.get(pickup.id) || 0,
      reliabilityBonus: reliabilityBonusByPickup.get(pickup.id) || 0,
    }
    breakdown.total = amount([
      breakdown.baseFee, breakdown.distanceAllowance, breakdown.weightAllowance,
      breakdown.heavyLoadBonus, breakdown.verifiedRecyclingBonus,
      breakdown.pickupCompletionBonus, breakdown.reliabilityBonus,
    ].reduce((sum, value) => sum + value, 0))
    return breakdown
  })

  return {
    breakdowns,
    total: Math.round(breakdowns.reduce((sum, item) => sum + item.total, 0) * 100) / 100,
    verifiedPickupCount: eligible.length,
  }
}
