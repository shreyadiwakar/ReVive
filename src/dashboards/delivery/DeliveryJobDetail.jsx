import { ArrowLeft, Package, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import PickupTimeline from '../../components/PickupTimeline'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { updateDeliveryJobStatus } from '../../services/dataService'
import { PICKUP_STATUS } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'

export default function DeliveryJobDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirmAction, setConfirmAction] = useState(null)

  const pickup = db.pickups.find((p) => p.id === id && p.deliveryPartnerId === user.id)

  if (!pickup) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-charcoal/60">Job not found or not assigned to you.</p>
        <Link to="/delivery/jobs" className="mt-3 inline-block text-sm font-semibold text-forest hover:underline">← Back to jobs</Link>
      </div>
    )
  }

  const nextAction =
    pickup.status === PICKUP_STATUS.PICKUP_SCHEDULED
      ? { label: 'Mark as collected', next: PICKUP_STATUS.COLLECTED, icon: Package }
      : pickup.status === PICKUP_STATUS.COLLECTED
        ? { label: 'Mark as delivered to center', next: PICKUP_STATUS.DELIVERED, icon: Truck }
        : null

  const handleConfirm = () => {
    const result = updateDeliveryJobStatus(pickup.id, user.id, confirmAction.next)
    if (!result.ok) toast.error(result.error)
    else toast.success(`Status updated: ${confirmAction.next}`)
    setConfirmAction(null)
    refresh()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button type="button" onClick={() => navigate('/delivery/jobs')} className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-forest">
        <ArrowLeft size={16} /> Back to jobs
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
          <p className="text-charcoal/60">Resident: <span className="font-medium text-charcoal">{pickup.userName}</span></p>
          <p className="text-charcoal/60">Pickup address: <span className="font-medium text-charcoal">{pickup.pickupAddress}</span></p>
          <p className="text-charcoal/60">Scheduled: <span className="font-medium text-charcoal">{formatDate(pickup.scheduledAt)}</span></p>
          <p className="text-charcoal/60">Deliver to: <span className="font-medium text-charcoal">{pickup.centerName}</span></p>
          {pickup.instructions && <p className="text-charcoal/60 sm:col-span-2">Instructions: <span className="font-medium text-charcoal">{pickup.instructions}</span></p>}
        </div>

        {nextAction ? (
          <button
            type="button"
            onClick={() => setConfirmAction(nextAction)}
            className="mt-5 flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition"
          >
            <nextAction.icon size={16} /> {nextAction.label}
          </button>
        ) : (
          <p className="mt-5 text-sm text-charcoal/50">
            {pickup.status === PICKUP_STATUS.VERIFIED
              ? 'This delivery is complete and recycling has been verified by the center.'
              : 'No further delivery action available for this job. Verification is handled by the recycling center.'}
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
        <h2 className="mb-5 text-sm font-semibold text-charcoal">Tracking timeline</h2>
        <PickupTimeline pickup={pickup} />
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.label}
        message="This will update the status visible to the resident and recycling center."
        confirmLabel="Confirm"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
