import { DollarSign } from 'lucide-react'
import { useState } from 'react'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import SimulatedBanner from '../../components/SimulatedBanner'
import StatCard from '../../components/StatCard'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { calculateDeliveryEarnings } from '../../services/deliveryEarnings'
import { formatDate, formatKg } from '../../utils/format'
import { backendEnabled } from '../../services/backendApi'
import { haversineKm, isValidLocation } from '../../services/mapServices'

const formatRupees = (amount) => `${String.fromCodePoint(0x20B9)}${Number(amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function DeliveryEarnings() {
  const { user } = useAuth()
  const { db, loading, error } = useAppData()
  const [page, setPage] = useState(1)
  const partnerPickups = db.pickups.filter((pickup) => pickup.deliveryPartnerId === user.id).map((pickup) => {
    if (pickup.earningDistanceKm != null || pickup.status !== 'Recycling Verified') return pickup
    const center = db.centers.find((item) => item.id === pickup.centerId)
    const pickupLocation = { latitude: pickup.pickupLatitude, longitude: pickup.pickupLongitude }
    return isValidLocation(user) && isValidLocation(pickupLocation) && isValidLocation(center)
      ? { ...pickup, earningDistanceKm: Math.round((haversineKm(user, pickupLocation) + haversineKm(pickupLocation, center)) * 100) / 100 }
      : pickup
  })
  const earnings = calculateDeliveryEarnings(partnerPickups)
  const breakdownByPickup = new Map(earnings.breakdowns.map((item) => [item.pickupId, item]))
  const verifiedPickups = partnerPickups
    .filter((pickup) => breakdownByPickup.has(pickup.id))
    .sort((a, b) => new Date(b.pointsAwardedAt || b.updatedAt || b.createdAt) - new Date(a.pointsAwardedAt || a.updatedAt || a.createdAt))
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(verifiedPickups.length / pageSize))
  const pagePickups = verifiedPickups.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize)
  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Earnings</h1>
      <p className="mt-1 text-charcoal/60">Payments are calculated only after the recycling center verifies a pickup.</p>
      {backendEnabled && loading && <p className="mt-2 text-sm text-charcoal/50">Loading verified deliveries...</p>}
      {backendEnabled && error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 max-w-sm"><SimulatedBanner compact /></div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <StatCard label="Verified earnings" value={formatRupees(earnings.total)} icon={DollarSign} tone="amber" />
        <StatCard label="Verified pickups" value={earnings.verifiedPickupCount} icon={DollarSign} />
      </div>

      {verifiedPickups.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={DollarSign} title="No verified earnings yet" description="A delivery appears here after its recycling weight is verified by the center." />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-emerald-100/70 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Verified</th>
                <th className="px-5 py-3">Weight</th>
                <th className="px-5 py-3">Distance</th>
                <th className="px-5 py-3">Payment</th>
              </tr>
            </thead>
            <tbody>
              {pagePickups.map((pickup) => {
                const item = breakdownByPickup.get(pickup.id)
                return (
                  <tr key={pickup.id} className="border-b border-emerald-50 last:border-0 align-top">
                    <td className="px-5 py-3 font-mono text-xs text-charcoal/60">{pickup.id}</td>
                    <td className="px-5 py-3 text-charcoal/70">{formatDate(item.verifiedAt)}</td>
                    <td className="px-5 py-3 text-charcoal">{formatKg(item.weightKg)}</td>
                    <td className="px-5 py-3 text-charcoal/70">{item.distanceKm == null ? 'Not recorded' : `${item.distanceKm.toFixed(1)} km`}</td>
                    <td className="px-5 py-3">
                      <strong className="text-forest">{formatRupees(item.total)}</strong>
                      <details className="mt-1 text-xs text-charcoal/55">
                        <summary className="cursor-pointer">Details</summary>
                        <p className="mt-1">Base {formatRupees(item.baseFee)} · Distance {formatRupees(item.distanceAllowance)} · Weight {formatRupees(item.weightAllowance)} · Bonuses {formatRupees(item.heavyLoadBonus + item.verifiedRecyclingBonus + item.pickupCompletionBonus + item.reliabilityBonus)}</p>
                      </details>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-5 pb-5">
            <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-charcoal/55">Earnings are added after the recycling center verifies a pickup. Tap “Details” on a row to see a short breakdown.</p>
    </div>
  )
}

