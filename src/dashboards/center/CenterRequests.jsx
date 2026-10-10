import { Inbox } from 'lucide-react'
import { useState } from 'react'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { centerConfirmReceived, resolveCenterIdForUser } from '../../services/dataService'
import { PICKUP_STATUS } from '../../utils/constants'
import { formatDate, formatKg } from '../../utils/format'

export default function CenterRequests() {
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const centerId = resolveCenterIdForUser(user.id)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [weight, setWeight] = useState('')

  const requests = db.pickups
    .filter((p) => p.centerId === centerId)
    .filter((p) => [PICKUP_STATUS.ACCEPTED, PICKUP_STATUS.PICKUP_SCHEDULED, PICKUP_STATUS.COLLECTED, PICKUP_STATUS.DELIVERED].includes(p.status))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

  const openConfirm = (p) => {
    setConfirmTarget(p)
    setWeight(String(p.quantityKg))
  }

  const handleConfirm = () => {
    if (!weight || Number(weight) <= 0) {
      toast.error('Enter a valid received weight.')
      return
    }
    const result = centerConfirmReceived(confirmTarget.id, user.id, weight)
    if (!result.ok) toast.error(result.error)
    else toast.success('Received quantity recorded. Ready for verification.')
    setConfirmTarget(null)
    refresh()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Incoming requests</h1>
      <p className="mt-1 text-charcoal/60">Track pickups en route and confirm received quantity on arrival.</p>

      {requests.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Inbox} title="No incoming requests" description="Pickups assigned to your center will appear here." />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm border border-emerald-100/70">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                <th className="px-5 py-3">Resident</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Est. weight</th>
                <th className="px-5 py-3">Expected</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((p) => (
                <tr key={p.id} className="border-b border-emerald-50 last:border-0">
                  <td className="px-5 py-3 text-charcoal">{p.userName}</td>
                  <td className="px-5 py-3 text-charcoal/70">{p.wasteCategory}</td>
                  <td className="px-5 py-3 text-charcoal/70">{formatKg(p.quantityKg)}</td>
                  <td className="px-5 py-3 text-charcoal/70">{formatDate(p.scheduledAt)}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3">
                    {p.status === PICKUP_STATUS.DELIVERED && p.verifiedWeightKg == null ? (
                      <button type="button" onClick={() => openConfirm(p)} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-dark">
                        Confirm received
                      </button>
                    ) : p.verifiedWeightKg != null ? (
                      <span className="text-xs font-medium text-emerald-700">Received {formatKg(p.verifiedWeightKg)}</span>
                    ) : (
                      <span className="text-xs text-charcoal/40">En route</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!confirmTarget} title="Confirm received quantity" onClose={() => setConfirmTarget(null)} maxWidth="max-w-sm">
        {confirmTarget && (
          <div className="space-y-4">
            <p className="text-sm text-charcoal/60">
              Request from <strong>{confirmTarget.userName}</strong> — estimated {formatKg(confirmTarget.quantityKg)} of {confirmTarget.wasteCategory}.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-charcoal">Received weight (kg)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
            <button type="button" onClick={handleConfirm} className="w-full rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
              Confirm quantity
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
