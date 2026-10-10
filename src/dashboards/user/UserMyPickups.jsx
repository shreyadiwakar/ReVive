import { Package } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cancelPickup } from '../../services/dataService'
import { CANCELLABLE_STATUSES, PICKUP_STATUS } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'

const FILTERS = ['All', ...Object.values(PICKUP_STATUS)]

export default function UserMyPickups() {
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const [filter, setFilter] = useState('All')
  const [cancelTarget, setCancelTarget] = useState(null)

  const pickups = db.pickups
    .filter((p) => p.userId === user.id)
    .filter((p) => filter === 'All' || p.status === filter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const handleCancel = () => {
    const result = cancelPickup(cancelTarget.id, user.id)
    if (!result.ok) toast.error(result.error)
    else toast.success('Pickup cancelled.')
    setCancelTarget(null)
    refresh()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">My pickups</h1>
      <p className="mt-1 text-charcoal/60">Track every request from pickup to verified recycling.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f ? 'border-forest bg-forest text-white' : 'border-emerald-200 text-charcoal/60 hover:bg-mint-light'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {pickups.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Package} title="No pickups found" description="Try a different filter or schedule a new pickup." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {pickups.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-charcoal/40">{p.id}</p>
                  <p className="mt-1 font-semibold text-charcoal">{p.wasteCategory} · {formatKg(p.quantityKg)}</p>
                  <p className="mt-1 text-sm text-charcoal/60">{p.centerName} · {formatDate(p.scheduledAt)}</p>
                  <p className="mt-1 text-sm text-charcoal/50">{p.deliveryPartnerName ? `Partner: ${p.deliveryPartnerName}` : 'Awaiting partner assignment'}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/user/track/${p.id}`} className="rounded-lg border border-emerald-200 px-3.5 py-1.5 text-sm font-semibold text-charcoal hover:bg-mint-light">
                  Track
                </Link>
                {CANCELLABLE_STATUSES.includes(p.status) && (
                  <button
                    type="button"
                    onClick={() => setCancelTarget(p)}
                    className="rounded-lg border border-red-200 px-3.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this pickup?"
        message={`Request ${cancelTarget?.id} will be cancelled. This cannot be undone.`}
        confirmLabel="Cancel pickup"
        danger
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
