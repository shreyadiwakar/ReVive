import { Factory, RefreshCw, Scale, ShieldAlert, Truck, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActivityChart from '../../components/ActivityChart'
import CategoryPieChart from '../../components/CategoryPieChart'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatCard from '../../components/StatCard'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { getAdminMetrics, getAllRewardTransactions, getCategoryBreakdown, getWeeklyActivity, resetDemoData } from '../../services/dataService'
import { formatDateTime } from '../../utils/format'

export default function AdminDashboard() {
  const { refresh } = useAppData()
  const toast = useToast()
  const [confirmReset, setConfirmReset] = useState(false)

  const metrics = getAdminMetrics()
  const weekly = getWeeklyActivity()
  const categories = getCategoryBreakdown()
  const transactions = getAllRewardTransactions().slice(0, 8)

  const handleReset = () => {
    resetDemoData()
    toast.success('Demo data has been reset to its seeded state.')
    setConfirmReset(false)
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Platform overview</h1>
          <p className="mt-1 text-charcoal/60">Monitor diversion, partner approvals, and reward liability.</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 transition"
        >
          <RefreshCw size={16} /> Reset demo data
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered users" value={metrics.totalUsers} icon={Users} />
        <StatCard label="Active delivery partners" value={metrics.activeDelivery} icon={Truck} />
        <StatCard label="Approved centers" value={metrics.approvedCenters} icon={Factory} />
        <StatCard label="Total waste recycled" value={`${metrics.totalWasteKg} kg`} icon={Scale} />
      </div>

      {(metrics.pendingDeliveryApps > 0 || metrics.pendingCenterApps > 0 || metrics.pendingVerification > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <ShieldAlert size={18} className="shrink-0" />
          <span className="font-medium">Action needed:</span>
          {metrics.pendingDeliveryApps > 0 && (
            <Link to="/admin/delivery-partners" className="underline">{metrics.pendingDeliveryApps} delivery applications</Link>
          )}
          {metrics.pendingCenterApps > 0 && (
            <Link to="/admin/centers" className="underline">{metrics.pendingCenterApps} center applications</Link>
          )}
          {metrics.pendingVerification > 0 && (
            <Link to="/admin/pickups" className="underline">{metrics.pendingVerification} pickups awaiting verification</Link>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityChart data={weekly} title="Platform recycling activity (kg, last 7 days)" />
        <CategoryPieChart data={categories} title="Waste collected by category" />
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
        <h2 className="text-sm font-semibold text-charcoal">Recent reward transactions</h2>
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

      <ConfirmDialog
        open={confirmReset}
        title="Reset all demo data?"
        message="This restores every account, pickup, and reward record to the original seeded state. Any changes made during this session will be lost."
        confirmLabel="Reset data"
        danger
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
