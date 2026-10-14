import { ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { resolveCenterIdForUser, verifyRecycling } from '../../services/dataService'
import { PICKUP_STATUS, ROLES } from '../../utils/constants'
import { formatDate, formatDateTime, formatKg } from '../../utils/format'
import { backendEnabled, verifyBackendPickup } from '../../services/backendApi'

export default function CenterVerification() {
  const { user } = useAuth()
  const { db, refresh, loading, error } = useAppData()
  const toast = useToast()
  const centerId = user.centerId || resolveCenterIdForUser(user.id)
  const [target, setTarget] = useState(null)
  const [pendingPage, setPendingPage] = useState(1)
  const [note, setNote] = useState('')
  const [weight, setWeight] = useState('')
  const [busy, setBusy] = useState(false)

  const pending = db.pickups
    .filter((p) => p.centerId === centerId && p.status === PICKUP_STATUS.DELIVERED && (backendEnabled || p.verifiedWeightKg != null))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  const pendingPageSize = 8
  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / pendingPageSize))
  const safePendingPage = Math.min(pendingPage, pendingTotalPages)
  const pendingPageItems = pending.slice((safePendingPage - 1) * pendingPageSize, safePendingPage * pendingPageSize)

  const verified = db.pickups
    .filter((p) => p.centerId === centerId && p.status === PICKUP_STATUS.VERIFIED)
    .sort((a, b) => new Date(b.pointsAwardedAt) - new Date(a.pointsAwardedAt))
    .slice(0, 8)

  const openVerify = (p) => {
    setTarget(p)
    setNote('')
    setWeight(String(p.verifiedWeightKg ?? p.quantityKg))
  }

  const handleVerify = async () => {
    setBusy(true)
    try {
      let points
      if (backendEnabled) {
        const result = await verifyBackendPickup(target.id, weight, note)
        points = result.reward?.pointsAwarded
      } else {
        const result = verifyRecycling(target.id, user.id, ROLES.CENTER, note)
        if (!result.ok) throw new Error(result.error)
        points = result.pickup.pointsAwarded
      }
      toast.success(`Recycling verified — ${points} points credited.`)
      setTarget(null)
      await refresh()
    } catch (reason) { toast.error(reason.message || 'Could not verify recycling.') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Verification</h1>
        <p className="mt-1 text-charcoal/60">Confirm recycling is complete to release reward points to the resident.</p>
        {backendEnabled && loading && <p className="mt-3 text-sm text-charcoal/60">Loading verification queue…</p>}
        {backendEnabled && error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>}
      </div>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-charcoal">Awaiting verification</h2>
          <span className="text-xs text-charcoal/50">{pending.length} total</span>
        </div>
        {pending.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={ClipboardCheck} title="Nothing to verify" description={backendEnabled ? 'Delivered pickups will appear here.' : 'Confirm received quantity on the requests page first.'} />
          </div>
        ) : (
          <div className="mt-3 grid gap-4">
            {pendingPageItems.map((p) => (
              <div key={p.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-charcoal/40">{p.id}</p>
                    <p className="mt-1 font-semibold text-charcoal">{p.wasteCategory} · {backendEnabled ? 'estimated' : 'received'} {formatKg(p.verifiedWeightKg ?? p.quantityKg)}</p>
                    <p className="mt-1 text-sm text-charcoal/60">{p.userName} · {formatDate(p.scheduledAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <button
                  type="button"
                  onClick={() => openVerify(p)}
                  className="mt-4 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark transition"
                >
                  Mark recycling verified
                </button>
              </div>
            ))}
            <Pagination page={safePendingPage} totalPages={pendingTotalPages} onChange={setPendingPage} />
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-charcoal">Recently verified</h2>
          <Link to="/center/inventory" className="text-sm font-semibold text-forest hover:underline">View all history</Link>
        </div>
        {verified.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal/50">No verification records yet.</p>
        ) : (
          <>
            <div className="mt-3 hidden overflow-x-auto rounded-2xl bg-white shadow-sm border border-emerald-100/70 sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                    <th className="px-5 py-3">Resident</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Weight</th>
                    <th className="px-5 py-3">Points</th>
                    <th className="px-5 py-3">Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {verified.map((p) => (
                    <tr key={p.id} className="border-b border-emerald-50 last:border-0">
                      <td className="px-5 py-3 text-charcoal">{p.userName}</td>
                      <td className="px-5 py-3 text-charcoal/70">{p.wasteCategory}</td>
                      <td className="px-5 py-3 text-charcoal/70">{formatKg(p.verifiedWeightKg)}</td>
                      <td className="px-5 py-3 font-semibold text-forest">+{p.pointsAwarded}</td>
                      <td className="px-5 py-3 text-charcoal/50">{formatDateTime(p.pointsAwardedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-3 sm:hidden">
              {verified.map((p) => (
                <div key={p.id} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-charcoal">{p.userName}</p>
                    <span className="font-semibold text-forest">+{p.pointsAwarded}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-charcoal/70">
                    <div className="flex items-center justify-between gap-3">
                      <span>Category</span>
                      <span className="font-medium text-charcoal">{p.wasteCategory}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Weight</span>
                      <span className="font-medium text-charcoal">{formatKg(p.verifiedWeightKg)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Verified</span>
                      <span>{formatDateTime(p.pointsAwardedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <Modal open={!!target} title="Confirm recycling verification" onClose={() => setTarget(null)} maxWidth="max-w-sm">
        {target && (
          <div className="space-y-4">
            <p className="text-sm text-charcoal/60">
              This will credit reward points to <strong>{target.userName}</strong> for {formatKg(weight || target.verifiedWeightKg || target.quantityKg)} of {target.wasteCategory}. This cannot be undone and points are only issued once.
            </p>
            {backendEnabled && <div><label className="mb-1 block text-sm font-medium text-charcoal">Verified weight (kg)</label><input type="number" min="0.1" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" /></div>}
            <div>
              <label className="mb-1 block text-sm font-medium text-charcoal">Verification notes (optional)</label>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
            </div>
            <button type="button" disabled={busy} onClick={handleVerify} className="w-full rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-forest-dark transition">
              {busy ? 'Verifying…' : 'Confirm verification'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
