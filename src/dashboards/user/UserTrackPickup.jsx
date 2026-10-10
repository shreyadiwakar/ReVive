import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import PickupTimeline from '../../components/PickupTimeline'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cancelPickup } from '../../services/dataService'
import { CANCELLABLE_STATUSES } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'

export default function UserTrackPickup() {
  const { id } = useParams()
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirmCancel, setConfirmCancel] = useState(false)

  const pickup = db.pickups.find((p) => p.id === id && p.userId === user.id)

  if (!pickup) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-charcoal/60">Pickup not found.</p>
        <Link to="/user/my-pickups" className="mt-3 inline-block text-sm font-semibold text-forest hover:underline">
          ← Back to my pickups
        </Link>
      </div>
    )
  }

  const handleCancel = () => {
    const result = cancelPickup(pickup.id, user.id)
    if (!result.ok) toast.error(result.error)
    else toast.success('Pickup cancelled.')
    setConfirmCancel(false)
    refresh()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button type="button" onClick={() => navigate('/user/my-pickups')} className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-forest">
        <ArrowLeft size={16} /> Back to my pickups
      </button>

      <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-charcoal/40">{pickup.id}</p>
            <h1 className="mt-1 text-xl font-bold text-charcoal">{pickup.wasteCategory} · {formatKg(pickup.quantityKg)}</h1>
          </div>
          <StatusBadge status={pickup.status} />
        </div>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p className="text-charcoal/60">Pickup address: <span className="font-medium text-charcoal">{pickup.pickupAddress}</span></p>
          <p className="text-charcoal/60">Scheduled: <span className="font-medium text-charcoal">{formatDate(pickup.scheduledAt)}</span></p>
          <p className="text-charcoal/60">Recycling center: <span className="font-medium text-charcoal">{pickup.centerName}</span></p>
          <p className="text-charcoal/60">Delivery partner: <span className="font-medium text-charcoal">{pickup.deliveryPartnerName || 'Not yet assigned'}</span></p>
          {pickup.verifiedWeightKg != null && (
            <p className="text-charcoal/60">Verified weight: <span className="font-medium text-charcoal">{formatKg(pickup.verifiedWeightKg)}</span></p>
          )}
          {pickup.pointsAwarded > 0 && (
            <p className="text-charcoal/60">Points awarded: <span className="font-medium text-forest">+{pickup.pointsAwarded}</span></p>
          )}
        </div>

        {CANCELLABLE_STATUSES.includes(pickup.status) && (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="mt-5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Cancel pickup
          </button>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
        <h2 className="mb-5 text-sm font-semibold text-charcoal">Tracking timeline</h2>
        <PickupTimeline pickup={pickup} />
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this pickup?"
        message="This request will be cancelled and cannot be resumed."
        confirmLabel="Cancel pickup"
        danger
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  )
}
