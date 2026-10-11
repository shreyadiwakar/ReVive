import { ArrowLeft, LocateFixed, MapPin, Package, Phone, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import PickupTimeline from '../../components/PickupTimeline'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { updateDeliveryJobStatus } from '../../services/dataService'
import { backendEnabled, getBackendPickup, updateBackendPickup } from '../../services/backendApi'
import { PICKUP_STATUS } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'
import DeliveryRouteMap from '../../components/DeliveryRouteMap'
import { formatDistance, getCurrentLocation, getDrivingDistance, isValidLocation } from '../../services/mapServices'

export default function DeliveryJobDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirmAction, setConfirmAction] = useState(null)
  const [remotePickup, setRemotePickup] = useState(null)
  const [loading, setLoading] = useState(backendEnabled)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [driverLocation, setDriverLocation] = useState(null)
  const [driverLocationSource, setDriverLocationSource] = useState('')
  const [routeLegs, setRouteLegs] = useState(null)
  const [routeError, setRouteError] = useState('')
  const [calculatingRoute, setCalculatingRoute] = useState(false)

  useEffect(() => {
    if (!backendEnabled) return
    let active = true
    setLoading(true)
    getBackendPickup(id).then((item) => { if (active) setRemotePickup(item) })
      .catch((reason) => { if (active) setLoadError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, db.pickups.length])

  const pickup = backendEnabled ? remotePickup : db.pickups.find((p) => p.id === id && p.deliveryPartnerId === user.id)

  if (loading) return <p className="text-sm text-charcoal/60">Loading delivery job…</p>

  if (!pickup) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p role={loadError ? 'alert' : undefined} className={loadError ? 'text-red-700' : 'text-charcoal/60'}>{loadError || 'Job not found or not assigned to you.'}</p>
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
  const center = db.centers.find((item) => item.id === pickup.centerId)

  const calculateRoute = async () => {
    setCalculatingRoute(true); setRouteError(''); setRouteLegs(null)
    try {
      if (!isValidLocation(pickup)) throw new Error('This pickup has no map pin. Ask the resident to add it to the pickup request.')
      if (!isValidLocation(center)) throw new Error('This center has no map pin. The center must save its facility location in Profile.')
      let location
      let locationSource = 'Current device location'
      try { location = await getCurrentLocation() }
      catch (locationError) {
        if (!isValidLocation(user)) throw locationError
        location = user
        locationSource = 'Saved home/base address (device location unavailable)'
      }
      setDriverLocation(location)
      setDriverLocationSource(locationSource)
      const [toPickup, toCenter] = await Promise.all([
        getDrivingDistance(location, pickup), getDrivingDistance(pickup, center),
      ])
      if (!toPickup || !toCenter) throw new Error('Could not calculate both route segments. Try again.')
      setRouteLegs({ toPickup, toCenter, total: { km: toPickup.km + toCenter.km, kind: toPickup.kind === 'road' && toCenter.kind === 'road' ? 'road' : 'straight' } })
    } catch (reason) { setRouteError(reason.message || 'Could not calculate route.') }
    finally { setCalculatingRoute(false) }
  }

  const handleConfirm = async () => {
    setBusy(true)
    try {
      if (backendEnabled) { await updateBackendPickup(pickup.id, confirmAction.next); setRemotePickup(await getBackendPickup(pickup.id)) }
      else { const result = updateDeliveryJobStatus(pickup.id, user.id, confirmAction.next); if (!result.ok) throw new Error(result.error) }
      toast.success(`Status updated: ${confirmAction.next}`)
      setConfirmAction(null)
      await refresh()
    } catch (reason) { toast.error(reason.message || 'Could not update delivery status.') }
    finally { setBusy(false) }
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
          {pickup.residentPhone && <p className="text-charcoal/60">Contact: <a href={`tel:${pickup.residentPhone}`} className="inline-flex items-center gap-1 font-medium text-forest hover:underline"><Phone size={14} />{pickup.residentPhone}</a></p>}
          <p className="flex items-start gap-1.5 text-charcoal/60 sm:col-span-2"><MapPin size={16} className="mt-0.5 shrink-0 text-forest" /><span>Pickup from: <span className="font-medium text-charcoal">{pickup.pickupAddress}</span><br /><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup.pickupAddress)}`} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-forest hover:underline">Open directions</a></span></p>
          <p className="text-charcoal/60">Scheduled: <span className="font-medium text-charcoal">{formatDate(pickup.scheduledAt)}</span></p>
          <p className="text-charcoal/60">Deliver to: <span className="font-medium text-charcoal">{pickup.centerName}</span></p>
          {pickup.instructions && <p className="text-charcoal/60 sm:col-span-2">Instructions: <span className="font-medium text-charcoal">{pickup.instructions}</span></p>}
        </div>

        {nextAction ? (
          <button
            type="button"
            onClick={() => setConfirmAction(nextAction)}
            disabled={busy}
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-semibold text-charcoal">Your route</h2><p className="mt-1 text-xs text-charcoal/55">Uses your current device location, or your saved home/base pin if location access is unavailable. Live location isn’t saved.</p></div>
          <button type="button" onClick={calculateRoute} disabled={calculatingRoute} className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"><LocateFixed size={14} /> {calculatingRoute ? 'Calculating…' : 'Calculate route'}</button>
        </div>
        {routeError && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{routeError}</p>}
        <DeliveryRouteMap driver={driverLocation} pickup={pickup} center={center} />
        {routeLegs ? <><p className="mt-2 text-xs text-charcoal/50">Starting from: {driverLocationSource}</p><div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <RouteDistance label="Driver → pickup" value={formatDistance(routeLegs.toPickup)} />
          <RouteDistance label="Pickup → center" value={formatDistance(routeLegs.toCenter)} />
          <RouteDistance label="Total distance" value={formatDistance(routeLegs.total)} />
        </div></> : <p className="mt-3 text-xs text-charcoal/55">The route needs a pickup pin and center pin. Distance is road distance when routing is available, otherwise a straight-line estimate.</p>}
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
        busy={busy}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

function RouteDistance({ label, value }) {
  return <div className="rounded-xl bg-mint-light px-3 py-2"><p className="text-xs text-charcoal/55">{label}</p><p className="mt-1 font-semibold text-forest">{value}</p></div>
}
