import { Factory, MessageSquare, Scale, ShieldAlert, Truck, Users } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import ActivityChart from '../../components/ActivityChart'
import CategoryPieChart from '../../components/CategoryPieChart'
import StatCard from '../../components/StatCard'
import { useAppData } from '../../context/AppDataContext'
import { getAdminMetrics, getAllRewardTransactions, getCategoryBreakdown, getWeeklyActivity } from '../../services/dataService'
import { formatDateTime } from '../../utils/format'
import { backendEnabled } from '../../services/backendApi'
import { PICKUP_STATUS, ROLES } from '../../utils/constants'

export default function AdminDashboard() {
  const { db, refresh, loading, error } = useAppData()

  useEffect(() => {
    if (!backendEnabled) return undefined
    const interval = window.setInterval(refresh, 15000)
    return () => window.clearInterval(interval)
  }, [refresh])

  const metrics = backendEnabled ? {
    totalUsers: db.users.filter((u) => u.role === ROLES.USER).length,
    activeDelivery: db.users.filter((u) => u.role === ROLES.DELIVERY && u.approvalStatus === 'approved' && u.status === 'active').length,
    approvedCenters: db.users.filter((u) => u.role === ROLES.CENTER && u.approvalStatus === 'approved' && u.status === 'active').length,
    totalWasteKg: Math.round(db.pickups.filter((p) => p.status === PICKUP_STATUS.VERIFIED).reduce((sum, p) => sum + Number(p.verifiedWeightKg || 0), 0) * 10) / 10,
    pendingDeliveryApps: db.users.filter((u) => u.role === ROLES.DELIVERY && u.approvalStatus === 'pending').length,
    pendingCenterApps: db.users.filter((u) => u.role === ROLES.CENTER && u.approvalStatus === 'pending').length,
  } : getAdminMetrics()
  const weekly = backendEnabled
    ? Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const key = date.toDateString()
      const kg = db.pickups.filter((p) => p.status === PICKUP_STATUS.VERIFIED
        && new Date(p.pointsAwardedAt || p.updatedAt || p.createdAt).toDateString() === key)
        .reduce((sum, p) => sum + Number(p.verifiedWeightKg || p.quantityKg || 0), 0)
      return { day: date.toLocaleDateString(undefined, { weekday: 'short' }), kg: Math.round(kg * 10) / 10 }
    })
    : getWeeklyActivity()
  const categories = backendEnabled
    ? Object.entries(db.pickups.filter((p) => p.status === PICKUP_STATUS.VERIFIED).reduce((totals, p) => {
      totals[p.wasteCategory] = (totals[p.wasteCategory] || 0) + Number(p.verifiedWeightKg || 0)
      return totals
    }, {})).map(([category, kg]) => ({ category, kg }))
    : getCategoryBreakdown()
  const transactions = (backendEnabled ? db.rewardTransactions : getAllRewardTransactions())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
  const openComplaints = [...(db.complaints || [])]
    .filter((complaint) => complaint.status !== 'resolved')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Platform overview</h1>
          <p className="mt-1 text-charcoal/60">Monitor diversion, partner approvals, and reward liability.</p>
        </div>
      </div>
      {backendEnabled && loading && <p className="text-sm text-charcoal/60">Loading live backend data…</p>}
      {backendEnabled && error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered users" value={metrics.totalUsers} icon={Users} />
        <StatCard label="Active delivery partners" value={metrics.activeDelivery} icon={Truck} />
        <StatCard label="Approved centers" value={metrics.approvedCenters} icon={Factory} />
        <StatCard label="Total waste recycled" value={`${metrics.totalWasteKg} kg`} icon={Scale} />
      </div>

      {(metrics.pendingDeliveryApps > 0 || metrics.pendingCenterApps > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <ShieldAlert size={18} className="shrink-0" />
          <span className="font-medium">Action needed:</span>
          {metrics.pendingDeliveryApps > 0 && (
            <Link to="/admin/delivery-partners" className="underline">{metrics.pendingDeliveryApps} delivery applications</Link>
          )}
          {metrics.pendingCenterApps > 0 && (
            <Link to="/admin/centers" className="underline">{metrics.pendingCenterApps} center applications</Link>
          )}
        </div>
      )}

      {openComplaints.length > 0 && (
        <Link to="/admin/complaints" className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-950 hover:bg-amber-100">
          <MessageSquare size={17} /> {openComplaints.length} {openComplaints.length === 1 ? 'complaint' : 'complaints'}
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityChart data={weekly} title="Platform recycling activity (kg, last 7 days)" />
        <CategoryPieChart data={categories} title="Waste collected by category" />
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-charcoal">Recent reward transactions</h2>
          <Link to="/admin/rewards#reward-activity" className="text-sm font-semibold text-forest hover:underline">View all</Link>
        </div>
        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal/50">No reward activity yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-charcoal/40">
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t border-emerald-50">
                    <td className="py-2.5 pr-4 text-charcoal">{t.userName}</td>
                    <td className="py-2.5 pr-4 text-charcoal/70">{t.description}</td>
                    <td className={`py-2.5 pr-4 font-semibold ${t.amount > 0 ? 'text-forest' : 'text-red-600'}`}>{t.amount > 0 ? `+${t.amount}` : t.amount}</td>
                    <td className="py-2.5 pr-4 text-charcoal/50">{formatDateTime(t.createdAt)}</td>
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
