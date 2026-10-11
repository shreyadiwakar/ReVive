import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import PickupTimeline from '../../components/PickupTimeline'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { cancelPickup } from '../../services/dataService'
import { backendEnabled, cancelBackendPickup, getBackendPickup } from '../../services/backendApi'
import { CANCELLABLE_STATUSES } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'
import { formatDistance, getDrivingDistance, haversineKm, isValidLocation } from '../../services/mapServices'

export default function UserTrackPickup() {
  const { id } = useParams()
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [remotePickup, setRemotePickup] = useState(null)
  const [loading, setLoading] = useState(backendEnabled)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!backendEnabled) return
    let active = true
    setLoading(true)
    getBackendPickup(id).then((item) => { if (active) setRemotePickup(item) })
      .catch((reason) => { if (active) setLoadError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, db.pickups.length])

  const pickup = backendEnabled ? remotePickup : db.pickups.find((p) => p.id === id && p.userId === user.id)
  const [centerDistance, setCenterDistance] = useState(null)

  useEffect(() => {
    let active = true
    const center = db.centers.find((item) => item.id === pickup?.centerId)
    if (!isValidLocation(pickup) || !isValidLocation(center)) {
      setCenterDistance(null)
      return () => { active = false }
    }
    setCenterDistance({ km: haversineKm(pickup, center), kind: 'straight' })
    getDrivingDistance(pickup, center).then((distance) => {
      if (active) setCenterDistance(distance)
    }).catch(() => { if (active) setCenterDistance(null) })
    return () => { active = false }
  }, [pickup?.id, pickup?.pickupLatitude, pickup?.pickupLongitude, pickup?.centerId, db.centers])

  if (loading) return <p className="text-sm text-charcoal/60">Loading pickup…</p>

  if (!pickup) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p role={loadError ? 'alert' : undefined} className={loadError ? 'text-red-700' : 'text-charcoal/60'}>{loadError || 'Pickup not found.'}</p>
        <Link to="/user/my-pickups" className="mt-3 inline-block text-sm font-semibold text-forest hover:underline">
          ← Back to my pickups
        </Link>
      </div>
    )
  }

  const handleCancel = async () => {
    setBusy(true)
    try {
      if (backendEnabled) { await cancelBackendPickup(pickup.id); setRemotePickup(await getBackendPickup(pickup.id)) }
      else { const result = cancelPickup(pickup.id, user.id); if (!result.ok) throw new Error(result.error) }
      toast.success('Pickup cancelled.')
      setConfirmCancel(false)
      refresh()
    } catch (reason) { toast.error(reason.message || 'Could not cancel pickup.') }
    finally { setBusy(false) }
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
          <p className="text-charcoal/60">Pickup to center distance: <span className="font-medium text-forest">{centerDistance ? formatDistance(centerDistance) : 'Unavailable: pickup or center map pin missing'}</span></p>
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
        confirmLabel={busy ? 'Cancelling…' : 'Cancel pickup'}
        busy={busy}
        danger
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  )
}
