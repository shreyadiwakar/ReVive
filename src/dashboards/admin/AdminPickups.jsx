import { Package } from 'lucide-react'
import { useMemo, useState } from 'react'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import PickupTimeline from '../../components/PickupTimeline'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { PICKUP_STATUS } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'

const FILTERS = ['All', ...Object.values(PICKUP_STATUS)]
const PAGE_SIZE = 8

export default function AdminPickups() {
  const { db } = useAppData()
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState(null)

  const filtered = useMemo(() => {
    return db.pickups
      .filter((p) => filter === 'All' || p.status === filter)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [db.pickups, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const getDeliveryPartnerName = (pickup) => {
    if (!pickup.deliveryPartnerId) return 'Unassigned'

    const partner = db.users.find((u) => String(u.id) === String(pickup.deliveryPartnerId))
    return partner?.name || pickup.deliveryPartnerName || 'Assigned partner'
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
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-2xl bg-white shadow-sm border border-emerald-100/70 sm:block">
            <table className="w-full min-w-0 text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                  <th className="px-3 py-3 sm:px-5">Request</th>
                  <th className="px-3 py-3 sm:px-5">Resident</th>
                  <th className="px-3 py-3 sm:px-5">Center</th>
                  <th className="px-3 py-3 sm:px-5">Delivery partner</th>
                  <th className="px-3 py-3 sm:px-5">Weight</th>
                  <th className="px-3 py-3 sm:px-5">Status</th>
                  <th className="px-3 py-3 sm:px-5">Scheduled</th>
                  <th className="px-3 py-3 sm:px-5">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id} className="border-b border-emerald-50 align-top last:border-0">
                    <td className="px-3 py-3 font-mono text-[11px] text-charcoal/50 sm:px-5">{p.id}</td>
                    <td className="break-words px-3 py-3 text-charcoal sm:px-5">{p.userName}</td>
                    <td className="break-words px-3 py-3 text-charcoal/70 sm:px-5">{p.centerName}</td>
                    <td className="break-words px-3 py-3 text-charcoal/70 sm:px-5">{getDeliveryPartnerName(p)}</td>
                    <td className="px-3 py-3 text-charcoal/70 sm:px-5">{formatKg(p.verifiedWeightKg ?? p.quantityKg)}</td>
                    <td className="px-3 py-3 sm:px-5"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-3 text-charcoal/50 sm:px-5">{formatDate(p.scheduledAt)}</td>
                    <td className="px-3 py-3 sm:px-5">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setViewing(p)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-mint-light">
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 sm:hidden">
            {pageItems.map((p) => (
              <div key={p.id} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] text-charcoal/50">{p.id}</p>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-charcoal/50">Resident</span>
                    <span className="text-right font-medium text-charcoal">{p.userName}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-charcoal/50">Center</span>
                    <span className="text-right font-medium text-charcoal">{p.centerName}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-charcoal/50">Partner</span>
                    <span className="text-right font-medium text-charcoal">{getDeliveryPartnerName(p)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-charcoal/50">Weight</span>
                    <span className="font-medium text-charcoal">{formatKg(p.verifiedWeightKg ?? p.quantityKg)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-charcoal/50">Scheduled</span>
                    <span className="text-right font-medium text-charcoal">{formatDate(p.scheduledAt)}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setViewing(p)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-mint-light">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 pb-5">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}

      <Modal open={!!viewing} title={viewing?.id} onClose={() => setViewing(null)}>
        {viewing && <PickupTimeline pickup={viewing} />}
      </Modal>

    </div>
  )
}
