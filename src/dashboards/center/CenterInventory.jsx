import { Archive } from 'lucide-react'
import CategoryPieChart from '../../components/CategoryPieChart'
import EmptyState from '../../components/EmptyState'
import StatCard from '../../components/StatCard'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { getCenterInventory, resolveCenterIdForUser } from '../../services/dataService'
import { formatDateTime, formatKg } from '../../utils/format'
import { backendEnabled } from '../../services/backendApi'
import { PICKUP_STATUS } from '../../utils/constants'

export default function CenterInventory() {
  const { user } = useAuth()
  const { db, loading, error } = useAppData()
  const centerId = resolveCenterIdForUser(user.id)
  const remoteRecords = db.pickups.filter((p) => p.centerId === centerId && p.status === PICKUP_STATUS.VERIFIED)
  const inventory = backendEnabled
    ? { records: remoteRecords, totals: Object.entries(remoteRecords.reduce((acc, p) => ({ ...acc, [p.wasteCategory]: (acc[p.wasteCategory] || 0) + Number(p.verifiedWeightKg || 0) }), {})).map(([category, kg]) => ({ category, kg })), totalKg: remoteRecords.reduce((sum, p) => sum + Number(p.verifiedWeightKg || 0), 0) }
    : getCenterInventory(centerId)
  const { records, totals, totalKg } = inventory

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Inventory</h1>
      <p className="mt-1 text-charcoal/60">Historical record of verified, processed material.</p>
      {backendEnabled && loading && <p className="mt-2 text-sm text-charcoal/60">Loading inventory…</p>}
      {backendEnabled && error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <StatCard label="Total processed" value={formatKg(totalKg)} icon={Archive} />
        <StatCard label="Verified records" value={records.length} icon={Archive} />
      </div>

      <div className="mt-5">
        <CategoryPieChart data={totals} title="Processed by category" />
      </div>

      <h2 className="mt-6 text-sm font-semibold text-charcoal">Verification history</h2>
      {records.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={Archive} title="No records yet" description="Verified pickups will be logged here for your records." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm border border-emerald-100/70">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Resident</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Weight</th>
                <th className="px-5 py-3">Verified</th>
              </tr>
            </thead>
            <tbody>
              {records.map((p) => (
                <tr key={p.id} className="border-b border-emerald-50 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-charcoal/50">{p.id}</td>
                  <td className="px-5 py-3 text-charcoal">{p.userName}</td>
                  <td className="px-5 py-3 text-charcoal/70">{p.wasteCategory}</td>
                  <td className="px-5 py-3 text-charcoal/70">{formatKg(p.verifiedWeightKg)}</td>
                  <td className="px-5 py-3 text-charcoal/50">{formatDateTime(p.pointsAwardedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
