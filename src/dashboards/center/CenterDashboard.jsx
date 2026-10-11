import { Archive, ClipboardCheck, Inbox, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import CategoryPieChart from '../../components/CategoryPieChart'
import EmptyState from '../../components/EmptyState'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { getCenterInventory, resolveCenterIdForUser } from '../../services/dataService'
import { PICKUP_STATUS } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'
import { backendEnabled } from '../../services/backendApi'

export default function CenterDashboard() {
  const { user } = useAuth()
  const { db, loading, error } = useAppData()
  const centerId = user.centerId || resolveCenterIdForUser(user.id)

  const centerPickups = db.pickups.filter((p) => p.centerId === centerId)
  const incoming = centerPickups.filter((p) =>
    [PICKUP_STATUS.ACCEPTED, PICKUP_STATUS.PICKUP_SCHEDULED, PICKUP_STATUS.COLLECTED, PICKUP_STATUS.DELIVERED].includes(p.status),
  )
  const today = new Date().toDateString()
  const receivedToday = centerPickups.filter((p) => p.verifiedWeightKg != null && new Date(p.scheduledAt).toDateString() === today)
  const awaitingVerification = centerPickups.filter((p) => p.status === PICKUP_STATUS.DELIVERED && p.verifiedWeightKg != null)
  const inventory = backendEnabled
    ? (() => {
      const records = centerPickups.filter((p) => p.status === PICKUP_STATUS.VERIFIED)
      const totals = records.reduce((acc, p) => ({ ...acc, [p.wasteCategory]: (acc[p.wasteCategory] || 0) + Number(p.verifiedWeightKg || 0) }), {})
      return { totalKg: records.reduce((sum, p) => sum + Number(p.verifiedWeightKg || 0), 0), totals: Object.entries(totals).map(([category, kg]) => ({ category, kg })) }
    })()
    : getCenterInventory(centerId)
  const { totalKg, totals } = inventory

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Center overview</h1>
        <p className="mt-1 text-charcoal/60">Monitor inbound material and the verification queue.</p>
        {backendEnabled && loading && <p className="mt-2 text-sm text-charcoal/60">Loading center activity…</p>}
        {backendEnabled && error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Incoming requests" value={incoming.length} icon={Inbox} />
        <StatCard label="Received today" value={receivedToday.length} icon={PackageCheck} />
        <StatCard label="Total processed" value={formatKg(totalKg)} icon={Archive} />
        <StatCard label="Awaiting verification" value={awaitingVerification.length} icon={ClipboardCheck} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryPieChart data={totals} title="Categories processed" />
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
          <h2 className="text-sm font-semibold text-charcoal">Awaiting verification</h2>
          {awaitingVerification.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={ClipboardCheck} title="Nothing to verify" description="Confirmed deliveries ready for verification appear here." />
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {awaitingVerification.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-mint-light px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-charcoal">{p.wasteCategory} · {formatKg(p.verifiedWeightKg)}</p>
                    <p className="text-xs text-charcoal/50">{p.userName} · {formatDate(p.scheduledAt)}</p>
                  </div>
                  <Link to="/center/verification" className="text-sm font-semibold text-forest hover:underline">Verify →</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal">Incoming requests</h2>
          <Link to="/center/requests" className="text-sm font-semibold text-forest hover:underline">Manage →</Link>
        </div>
        {incoming.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={Inbox} title="No incoming requests" description="Accepted pickups heading to your center will show here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-charcoal/40">
                  <th className="pb-2 pr-4">Resident</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Quantity</th>
                  <th className="pb-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {incoming.slice(0, 6).map((p) => (
                  <tr key={p.id} className="border-t border-emerald-50">
                    <td className="py-2.5 pr-4 text-charcoal">{p.userName}</td>
                    <td className="py-2.5 pr-4 text-charcoal/70">{p.wasteCategory}</td>
                    <td className="py-2.5 pr-4 text-charcoal/70">{formatKg(p.quantityKg)}</td>
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
