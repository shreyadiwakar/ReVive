import { MapPin, Package } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { acceptPickupJob } from '../../services/dataService'
import { acceptBackendPickup, backendEnabled } from '../../services/backendApi'
import { PICKUP_STATUS } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'
import { formatDistance, getDrivingDistance, getDrivingDistances, haversineKm, isValidLocation } from '../../services/mapServices'
import { VEHICLE_WEIGHT_LIMIT_KG } from '../../utils/constants'

export default function DeliveryJobs() {
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const [acceptTarget, setAcceptTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [jobDistances, setJobDistances] = useState(new Map())
  const { loading, error } = useAppData()
  const vehicleLimit = VEHICLE_WEIGHT_LIMIT_KG[user.vehicleType]

  const available = db.pickups.filter((p) => p.status === PICKUP_STATUS.REQUESTED && !p.deliveryPartnerId)
  const myActive = db.pickups
    .filter((p) => p.deliveryPartnerId === user.id && ![PICKUP_STATUS.VERIFIED, PICKUP_STATUS.CANCELLED].includes(p.status))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  const distanceFromBase = (pickup) => {
    const pickupLocation = { latitude: pickup.pickupLatitude, longitude: pickup.pickupLongitude }
    return isValidLocation(user) && isValidLocation(pickupLocation)
      ? formatDistance({ km: haversineKm(user, pickupLocation), kind: 'straight' })
      : ''
  }

  useEffect(() => {
    let active = true
    const jobs = [...new Map([...available, ...myActive].map((pickup) => [pickup.id, pickup])).values()]
    const pickupStops = jobs.map((pickup) => ({ id: pickup.id, location: { latitude: pickup.pickupLatitude, longitude: pickup.pickupLongitude } }))
    setJobDistances(new Map(jobs.map((pickup) => {
      const pickupLocation = { latitude: pickup.pickupLatitude, longitude: pickup.pickupLongitude }
      const center = db.centers.find((item) => item.id === pickup.centerId)
      const fromBaseKm = isValidLocation(user) && isValidLocation(pickupLocation) ? haversineKm(user, pickupLocation) : null
      const toCenterKm = isValidLocation(center) && isValidLocation(pickupLocation) ? haversineKm(pickupLocation, center) : null
      return [pickup.id, {
        fromBase: fromBaseKm == null ? null : { km: fromBaseKm, kind: 'straight' },
        toCenter: toCenterKm == null ? null : { km: toCenterKm, kind: 'straight' },
        total: fromBaseKm == null || toCenterKm == null ? null : { km: fromBaseKm + toCenterKm, kind: 'straight' },
      }]
    })))
    const baseDistancesPromise = isValidLocation(user) ? getDrivingDistances(user, pickupStops) : Promise.resolve(new Map())
    Promise.all(jobs.map(async (pickup) => {
      const center = db.centers.find((item) => item.id === pickup.centerId)
      const pickupLocation = { latitude: pickup.pickupLatitude, longitude: pickup.pickupLongitude }
      const toCenter = isValidLocation(center) && isValidLocation(pickupLocation)
        ? await getDrivingDistance(pickupLocation, center) : null
      return [pickup.id, { toCenter }]
    })).then(async (centerResults) => {
      const fromBase = await baseDistancesPromise
      if (!active) return
      setJobDistances(new Map(centerResults.map(([id, legs]) => [id, {
        ...legs,
        fromBase: fromBase.get(id) ?? null,
        total: fromBase.has(id) && legs.toCenter
          ? { km: fromBase.get(id).km + legs.toCenter.km, kind: fromBase.get(id).kind === 'road' && legs.toCenter.kind === 'road' ? 'road' : 'straight' }
          : null,
      }])))
    }).catch(() => { if (active) setJobDistances(new Map()) })
    return () => { active = false }
  }, [db.centers, db.pickups, user, available.length, myActive.length])

  const routeDistance = (pickup) => jobDistances.get(pickup.id)

  const handleAccept = async () => {
    setBusy(true)
    try {
      if (backendEnabled) await acceptBackendPickup(acceptTarget.id)
      else { const result = acceptPickupJob(acceptTarget.id, user.id); if (!result.ok) throw new Error(result.error) }
      toast.success('Job accepted!')
      setAcceptTarget(null)
      await refresh()
    } catch (reason) { toast.error(reason.message || 'Could not accept job.') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Jobs</h1>
        <p className="mt-1 text-charcoal/60">Accept nearby pickup requests and manage your active deliveries.</p>
        {backendEnabled && loading && <p className="mt-3 text-sm text-charcoal/60">Loading delivery jobs…</p>}
        {backendEnabled && error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-charcoal">My active jobs</h2>
        {myActive.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={Package} title="No active jobs" description="Accept a job below to get started." />
          </div>
        ) : (
          <div className="mt-3 grid gap-4">
            {myActive.map((p) => (
              <div key={p.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-charcoal/40">{p.id}</p>
                    <p className="mt-1 font-semibold text-charcoal">{p.wasteCategory} · {formatKg(p.quantityKg)}</p>
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-charcoal/70"><MapPin size={16} className="mt-0.5 shrink-0 text-forest" /><span><span className="font-semibold text-charcoal">Pickup from:</span> {p.pickupAddress}</span></p>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.pickupAddress)}`} target="_blank" rel="noreferrer" className="ml-5 mt-1 inline-block text-sm font-semibold text-forest hover:underline">Open directions</a>
                    <p className="mt-1 text-sm text-charcoal/50">{formatDate(p.scheduledAt)} → {p.centerName}</p>
                    <DistanceSummary distances={routeDistance(p)} fallbackFromBase={distanceFromBase(p)} />
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <Link to={`/delivery/jobs/${p.id}`} className="mt-4 inline-block rounded-lg border border-emerald-200 px-3.5 py-1.5 text-sm font-semibold text-charcoal hover:bg-mint-light">
                  Manage job
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-charcoal">Available jobs</h2>
        {available.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={Package} title="No jobs available" description="New pickup requests will appear here as residents schedule them." />
          </div>
        ) : (
          <div className="mt-3 grid gap-4">
            {available.map((p) => (
              <div key={p.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-charcoal/40">{p.id}</p>
                    <p className="mt-1 font-semibold text-charcoal">{p.wasteCategory} · {formatKg(p.quantityKg)}</p>
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-charcoal/70"><MapPin size={16} className="mt-0.5 shrink-0 text-forest" /><span><span className="font-semibold text-charcoal">Pickup from:</span> {p.pickupAddress}</span></p>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.pickupAddress)}`} target="_blank" rel="noreferrer" className="ml-5 mt-1 inline-block text-sm font-semibold text-forest hover:underline">Preview location</a>
                    <p className="mt-1 text-sm text-charcoal/50">{formatDate(p.scheduledAt)} → {p.centerName}</p>
                    <DistanceSummary distances={routeDistance(p)} fallbackFromBase={distanceFromBase(p)} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAcceptTarget(p)}
                    disabled={busy || !vehicleLimit || Number(p.quantityKg) > vehicleLimit}
                    className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark transition"
                  >
                    Accept
                  </button>
                </div>
                {vehicleLimit && Number(p.quantityKg) > vehicleLimit && <p className="mt-3 text-sm text-amber-800">This pickup is over your vehicle's {vehicleLimit} kg capacity.</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!acceptTarget}
        title="Accept this job?"
        message={`You'll be responsible for collecting ${acceptTarget?.wasteCategory} (${acceptTarget?.quantityKg} kg) and delivering it to ${acceptTarget?.centerName}.`}
        confirmLabel={busy ? 'Accepting…' : 'Accept job'}
        busy={busy}
        onConfirm={handleAccept}
        onCancel={() => setAcceptTarget(null)}
      />
    </div>
  )
}

function DistanceSummary({ distances, fallbackFromBase }) {
  const values = [
    ['Your base â†’ pickup', distances?.fromBase, fallbackFromBase],
    ['Pickup â†’ center', distances?.toCenter, ''],
    ['Complete route', distances?.total, ''],
  ].filter(([, distance, fallback]) => distance || fallback)
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3" aria-label="Estimated route distances">
      {values.map(([label, distance, fallback]) => (
        <div key={label} className="rounded-lg bg-mint-light px-3 py-2">
          <p className="text-[11px] text-charcoal/60">{label.replace(/base.*pickup/i, 'Base to pickup').replace(/pickup.*center/i, 'Pickup to center')}</p>
          <p className="mt-0.5 text-sm font-bold text-forest">{distance ? `${distance.km.toFixed(1)} km` : fallback}</p>
          {distance && <p className="text-[10px] text-charcoal/50">{distance.kind === 'road' ? 'by road' : 'straight-line estimate'}</p>}
        </div>
      ))}
    </div>
  )
}
