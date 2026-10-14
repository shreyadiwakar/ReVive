import { CheckCircle2, DollarSign, Package, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/EmptyState'
import ReportComplaint from '../../components/ReportComplaint'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { PICKUP_STATUS } from '../../utils/constants'
import { formatCurrency, formatDate, formatKg } from '../../utils/format'
import { backendEnabled } from '../../services/backendApi'
import { calculateDeliveryEarnings } from '../../services/deliveryEarnings'

export default function DeliveryDashboard() {
  const { user } = useAuth()
  const { db, loading, error } = useAppData()

  const available = db.pickups.filter((p) => p.status === PICKUP_STATUS.REQUESTED && !p.deliveryPartnerId)
  const myJobs = db.pickups.filter((p) => p.deliveryPartnerId === user.id)
  const active = myJobs.filter((p) => ![PICKUP_STATUS.VERIFIED, PICKUP_STATUS.CANCELLED].includes(p.status))
  const earnings = calculateDeliveryEarnings(myJobs)
  const recent = [...myJobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-charcoal/60">Here's what's moving on your route today.</p>
        {backendEnabled && loading && <p className="mt-2 text-sm text-charcoal/50">Loading your route…</p>}
        {backendEnabled && error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available jobs" value={available.length} icon={Package} />
        <StatCard label="Active jobs" value={active.length} icon={Truck} />
        <StatCard label="Verified deliveries" value={earnings.verifiedPickupCount} icon={CheckCircle2} />
        <StatCard label="Verified earnings" value={formatCurrency(earnings.total)} hint="Itemized on Earnings page" icon={DollarSign} tone="amber" />
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-charcoal">Recent activity</h2>
          <Link to="/delivery/earnings" className="text-sm font-semibold text-forest hover:underline">View delivery history</Link>
        </div>
        {recent.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={Truck} title="No jobs yet" description="Accept an available job to start your first delivery." />
          </div>
        ) : (
          <>
            <div className="mt-3 hidden overflow-x-auto sm:block">
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

            <div className="mt-3 space-y-3 sm:hidden">
              {recent.map((p) => (
                <div key={p.id} className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Link to={`/delivery/jobs/${p.id}`} className="font-mono text-[10px] text-forest hover:underline">{p.id}</Link>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-2 space-y-2 text-sm text-charcoal/70">
                    <div className="flex items-center justify-between gap-3">
                      <span>Resident</span>
                      <span className="font-medium text-charcoal">{p.userName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Scheduled</span>
                      <span className="font-medium text-charcoal">{formatDate(p.scheduledAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Qty</span>
                      <span className="font-medium text-charcoal">{formatKg(p.quantityKg)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <ReportComplaint />
    </div>
  )
}
