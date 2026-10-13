import { ListChecks, Package, PlusCircle, Recycle, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActivityChart from '../../components/ActivityChart'
import EmptyState from '../../components/EmptyState'
import ReportComplaint from '../../components/ReportComplaint'
import PointsGauge from '../../components/PointsGauge'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { getWeeklyActivity } from '../../services/dataService'
import { PICKUP_STATUS } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'

export default function UserDashboard() {
  const { user } = useAuth()
  const { db, loading, error, backendEnabled } = useAppData()

  const pickups = db.pickups.filter((p) => p.userId === user.id)
  const verified = pickups.filter((p) => p.status === PICKUP_STATUS.VERIFIED)
  const totalKg = verified.reduce((s, p) => s + (p.verifiedWeightKg ?? p.quantityKg), 0)
  const upcoming = pickups
    .filter((p) => ![PICKUP_STATUS.VERIFIED, PICKUP_STATUS.CANCELLED].includes(p.status))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0]
  const recent = [...pickups].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
  const weekly = backendEnabled
    ? (() => {
      const days = []
      for (let i = 6; i >= 0; i -= 1) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        days.push({ key: date.toDateString(), day: date.toLocaleDateString(undefined, { weekday: 'short' }), kg: 0 })
      }
      pickups.filter((p) => p.status === PICKUP_STATUS.VERIFIED).forEach((p) => {
        const recycledAt = p.pointsAwardedAt || p.updatedAt || p.createdAt
        const bucket = days.find((item) => item.key === new Date(recycledAt).toDateString())
        if (bucket) bucket.kg += Number(p.verifiedWeightKg ?? p.quantityKg)
      })
      return days.map(({ day, kg }) => ({ day, kg: Math.round(kg * 10) / 10 }))
    })()
    : getWeeklyActivity(user.id)
  const points = backendEnabled ? (db.rewardsBalance ?? 0) : (user?.points ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Hello, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
          <p className="mt-1 text-charcoal/60">Here's your recycling impact at a glance.</p>
          {backendEnabled && loading && <p className="mt-2 text-sm text-charcoal/50">Loading your backend data…</p>}
          {backendEnabled && error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
        <Link
          to="/user/schedule-pickup"
          className="flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition"
        >
          <PlusCircle size={18} /> Schedule pickup
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total waste recycled" value={formatKg(totalKg)} icon={Recycle} />
        <StatCard label="Points earned" value={points.toLocaleString()} icon={Star} tone="amber" />
        <StatCard label="Completed pickups" value={verified.length} icon={ListChecks} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70 lg:col-span-1">
            <PointsGauge points={points} rewards={db.coupons} />
          <Link
            to="/user/rewards"
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition"
          >
            Redeem rewards
          </Link>
        </div>
        <div className="lg:col-span-2">
          <ActivityChart data={weekly} title="Recycling activity this week (kg)" />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
        <h2 className="text-sm font-semibold text-charcoal">Upcoming pickup</h2>
        {upcoming ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mint-light p-4">
            <div>
              <p className="font-semibold text-charcoal">{upcoming.wasteCategory} · {formatKg(upcoming.quantityKg)}</p>
              <p className="text-sm text-charcoal/60">{formatDate(upcoming.scheduledAt)} · {upcoming.centerName}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={upcoming.status} />
              <Link to={`/user/track/${upcoming.id}`} className="text-sm font-semibold text-forest hover:underline">
                Track →
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-charcoal/50">No upcoming pickups scheduled.</p>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal">Recent activity</h2>
          <Link to="/user/my-pickups" className="text-sm font-semibold text-forest hover:underline">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Package}
              title="No pickups yet"
              description="Schedule your first pickup to start earning reward points."
              action={
                <Link to="/user/schedule-pickup" className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark">
                  Schedule pickup
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-charcoal/40">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Quantity</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Points</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id} className="border-t border-emerald-50">
                    <td className="py-2.5 pr-4 text-charcoal/70">{formatDate(p.createdAt)}</td>
                    <td className="py-2.5 pr-4 text-charcoal">{p.wasteCategory}</td>
                    <td className="py-2.5 pr-4 text-charcoal/70">{formatKg(p.quantityKg)}</td>
                    <td className="py-2.5 pr-4"><StatusBadge status={p.status} /></td>
                    <td className="py-2.5 pr-4 font-medium text-forest">{p.pointsAwarded > 0 ? `+${p.pointsAwarded}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ReportComplaint />
    </div>
  )
}
