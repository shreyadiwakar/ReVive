import { CheckCircle2, DollarSign, Package, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/EmptyState'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { DELIVERY_RATE_PER_KG, PICKUP_STATUS } from '../../utils/constants'
import { formatCurrency, formatDate, formatKg } from '../../utils/format'

export default function DeliveryDashboard() {
  const { user } = useAuth()
  const { db } = useAppData()

  const available = db.pickups.filter((p) => p.status === PICKUP_STATUS.REQUESTED && !p.deliveryPartnerId)
  const myJobs = db.pickups.filter((p) => p.deliveryPartnerId === user.id)
  const active = myJobs.filter((p) => ![PICKUP_STATUS.VERIFIED, PICKUP_STATUS.CANCELLED].includes(p.status))
  const completed = myJobs.filter((p) => [PICKUP_STATUS.DELIVERED, PICKUP_STATUS.VERIFIED].includes(p.status))
  const estimatedEarnings = completed.reduce((sum, p) => sum + (p.verifiedWeightKg ?? p.quantityKg) * DELIVERY_RATE_PER_KG, 0)
  const recent = [...myJobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-charcoal/60">Here's what's moving on your route today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available jobs" value={available.length} icon={Package} />
        <StatCard label="Active jobs" value={active.length} icon={Truck} />
        <StatCard label="Completed deliveries" value={completed.length} icon={CheckCircle2} />
        <StatCard label="Estimated earnings" value={formatCurrency(estimatedEarnings)} hint="Simulated" icon={DollarSign} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/delivery/jobs" className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
          View available jobs
        </Link>
        <Link to="/delivery/earnings" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-mint-light transition">
          View earnings
        </Link>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
        <h2 className="text-sm font-semibold text-charcoal">Recent activity</h2>
        {recent.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={Truck} title="No jobs yet" description="Accept an available job to start your first delivery." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-charcoal/40">
                  <th className="pb-2 pr-4">Request</th>
                  <th className="pb-2 pr-4">Resident</th>
                  <th className="pb-2 pr-4">Scheduled</th>
                  <th className="pb-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id} className="border-t border-emerald-50">
                    <td className="py-2.5 pr-4">
                      <Link to={`/delivery/jobs/${p.id}`} className="font-mono text-xs text-forest hover:underline">{p.id}</Link>
                    </td>
                    <td className="py-2.5 pr-4 text-charcoal">{p.userName}</td>
                    <td className="py-2.5 pr-4 text-charcoal/70">{formatDate(p.scheduledAt)} · {formatKg(p.quantityKg)}</td>
                    <td className="py-2.5 pr-4"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
