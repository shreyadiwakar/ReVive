import { Package } from 'lucide-react'
import { useMemo, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import PickupTimeline from '../../components/PickupTimeline'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { verifyRecycling } from '../../services/dataService'
import { PICKUP_STATUS, ROLES } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'

const FILTERS = ['All', ...Object.values(PICKUP_STATUS)]
const PAGE_SIZE = 8

export default function AdminPickups() {
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState(null)
  const [verifyTarget, setVerifyTarget] = useState(null)

  const filtered = useMemo(() => {
    return db.pickups
      .filter((p) => filter === 'All' || p.status === filter)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [db.pickups, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleVerify = () => {
    const result = verifyRecycling(verifyTarget.id, user.id, ROLES.ADMIN, 'Verified by platform admin')
    if (!result.ok) toast.error(result.error)
    else toast.success(`Verified — ${result.pickup.pointsAwarded} points credited.`)
    setVerifyTarget(null)
    refresh()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Pickups</h1>
      <p className="mt-1 text-charcoal/60">Monitor every request across the platform.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFilter(f); setPage(1) }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f ? 'border-forest bg-forest text-white' : 'border-emerald-200 text-charcoal/60 hover:bg-mint-light'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {pageItems.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Package} title="No pickups found" description="Try a different filter." />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm border border-emerald-100/70">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Resident</th>
                <th className="px-5 py-3">Center</th>
                <th className="px-5 py-3">Weight</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Scheduled</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p.id} className="border-b border-emerald-50 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-charcoal/50">{p.id}</td>
                  <td className="px-5 py-3 text-charcoal">{p.userName}</td>
                  <td className="px-5 py-3 text-charcoal/70">{p.centerName}</td>
                  <td className="px-5 py-3 text-charcoal/70">{formatKg(p.verifiedWeightKg ?? p.quantityKg)}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-charcoal/50">{formatDate(p.scheduledAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setViewing(p)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-mint-light">
                        View
                      </button>
                      {p.status === PICKUP_STATUS.DELIVERED && p.verifiedWeightKg != null && (
                        <button type="button" onClick={() => setVerifyTarget(p)} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-dark">
                          Verify
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 pb-5">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}

      <Modal open={!!viewing} title={viewing?.id} onClose={() => setViewing(null)}>
        {viewing && <PickupTimeline pickup={viewing} />}
      </Modal>

      <ConfirmDialog
        open={!!verifyTarget}
        title="Verify this pickup?"
        message="As an administrator, this will credit reward points on behalf of the recycling center. Use this only when the center cannot verify directly."
        confirmLabel="Verify & credit points"
        onConfirm={handleVerify}
        onCancel={() => setVerifyTarget(null)}
      />
    </div>
  )
}
