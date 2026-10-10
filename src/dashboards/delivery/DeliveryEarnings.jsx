import { DollarSign } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import SimulatedBanner from '../../components/SimulatedBanner'
import StatCard from '../../components/StatCard'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { DELIVERY_RATE_PER_KG, PICKUP_STATUS } from '../../utils/constants'
import { formatCurrency, formatDate, formatKg } from '../../utils/format'
import { backendEnabled } from '../../services/backendApi'

export default function DeliveryEarnings() {
  const { user } = useAuth()
  const { db, loading, error } = useAppData()

  const completed = db.pickups
    .filter((p) => p.deliveryPartnerId === user.id && [PICKUP_STATUS.DELIVERED, PICKUP_STATUS.VERIFIED].includes(p.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const total = completed.reduce((sum, p) => sum + (p.verifiedWeightKg ?? p.quantityKg) * DELIVERY_RATE_PER_KG, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Earnings</h1>
      <p className="mt-1 text-charcoal/60">Estimated earnings based on completed deliveries.</p>
      {backendEnabled && loading && <p className="mt-2 text-sm text-charcoal/50">Loading completed deliveries…</p>}
      {backendEnabled && error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 max-w-sm">
        <SimulatedBanner compact />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <StatCard label="Total estimated earnings" value={formatCurrency(total)} icon={DollarSign} tone="amber" hint={`₹${DELIVERY_RATE_PER_KG}/kg simulated rate`} />
        <StatCard label="Completed deliveries" value={completed.length} icon={DollarSign} />
      </div>

      {completed.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={DollarSign} title="No completed deliveries yet" description="Finish a job to see simulated earnings here." />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm border border-emerald-100/70">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Weight</th>
                <th className="px-5 py-3">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {completed.map((p) => (
                <tr key={p.id} className="border-b border-emerald-50 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-charcoal/50">{p.id}</td>
                  <td className="px-5 py-3 text-charcoal/70">{formatDate(p.scheduledAt)}</td>
                  <td className="px-5 py-3 text-charcoal">{formatKg(p.verifiedWeightKg ?? p.quantityKg)}</td>
                  <td className="px-5 py-3 font-semibold text-forest">{formatCurrency((p.verifiedWeightKg ?? p.quantityKg) * DELIVERY_RATE_PER_KG)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
