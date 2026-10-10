import { Package } from 'lucide-react'
import { useState } from 'react'
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

export default function DeliveryJobs() {
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const [acceptTarget, setAcceptTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const { loading, error } = useAppData()

  const available = db.pickups.filter((p) => p.status === PICKUP_STATUS.REQUESTED && !p.deliveryPartnerId)
  const myActive = db.pickups
    .filter((p) => p.deliveryPartnerId === user.id && ![PICKUP_STATUS.VERIFIED, PICKUP_STATUS.CANCELLED].includes(p.status))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

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
                    <p className="mt-1 text-sm text-charcoal/60">{p.pickupAddress}</p>
                    <p className="mt-1 text-sm text-charcoal/50">{formatDate(p.scheduledAt)} → {p.centerName}</p>
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
                    <p className="mt-1 text-sm text-charcoal/60">{p.pickupAddress}</p>
                    <p className="mt-1 text-sm text-charcoal/50">{formatDate(p.scheduledAt)} → {p.centerName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAcceptTarget(p)}
                    disabled={busy}
                    className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark transition"
                  >
                    Accept
                  </button>
                </div>
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
