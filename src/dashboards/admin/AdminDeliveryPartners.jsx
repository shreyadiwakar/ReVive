import { Truck } from 'lucide-react'
import { useState } from 'react'
import ApprovalBadge from '../../components/ApprovalBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { setAccountStatus, setApprovalStatus } from '../../services/dataService'
import { ACCOUNT_STATUS, APPROVAL_STATUS, ROLES } from '../../utils/constants'
import { formatDate } from '../../utils/format'

export default function AdminDeliveryPartners() {
  const { db, refresh } = useAppData()
  const toast = useToast()
  const [action, setAction] = useState(null)

  const partners = db.users
    .filter((u) => u.role === ROLES.DELIVERY)
    .sort((a) => (a.approvalStatus === APPROVAL_STATUS.PENDING ? -1 : 1))

  const runAction = () => {
    if (action.type === 'approve') setApprovalStatus(action.user.id, APPROVAL_STATUS.APPROVED)
    if (action.type === 'reject') setApprovalStatus(action.user.id, APPROVAL_STATUS.REJECTED)
    if (action.type === 'suspend') setAccountStatus(action.user.id, ACCOUNT_STATUS.SUSPENDED)
    if (action.type === 'activate') setAccountStatus(action.user.id, ACCOUNT_STATUS.ACTIVE)
    toast.success(`${action.user.name} updated.`)
    setAction(null)
    refresh()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Delivery partners</h1>
      <p className="mt-1 text-charcoal/60">Review applications and manage active partners.</p>

      {partners.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Truck} title="No delivery partners" description="Applications will appear here once submitted." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {partners.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-charcoal">{p.name}</p>
                  <p className="text-sm text-charcoal/60">{p.email} · {p.phone}</p>
                  <p className="mt-1 text-sm text-charcoal/60">{p.vehicleType} · {p.vehicleReg}</p>
                  <p className="text-sm text-charcoal/50">Service area: {p.serviceArea} · Applied {formatDate(p.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ApprovalBadge status={p.approvalStatus} />
                  <ApprovalBadge status={p.status} />
                  <span className="text-xs text-charcoal/50">ID verified: {p.identityVerified ? 'Yes' : 'No'}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.approvalStatus === APPROVAL_STATUS.PENDING && (
                  <>
                    <button type="button" onClick={() => setAction({ type: 'approve', user: p })} className="rounded-lg bg-forest px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-forest-dark">
                      Approve
                    </button>
                    <button type="button" onClick={() => setAction({ type: 'reject', user: p })} className="rounded-lg border border-red-200 px-3.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                      Reject
                    </button>
                  </>
                )}
                {p.approvalStatus === APPROVAL_STATUS.APPROVED && (
                  <button
                    type="button"
                    onClick={() => setAction({ type: p.status === ACCOUNT_STATUS.SUSPENDED ? 'activate' : 'suspend', user: p })}
                    className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold ${
                      p.status === ACCOUNT_STATUS.SUSPENDED ? 'border-emerald-200 text-forest hover:bg-mint-light' : 'border-red-200 text-red-700 hover:bg-red-50'
                    }`}
                  >
                    {p.status === ACCOUNT_STATUS.SUSPENDED ? 'Activate' : 'Suspend'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!action}
        title={`${action?.type?.charAt(0).toUpperCase()}${action?.type?.slice(1)} this partner?`}
        message={`This will update ${action?.user?.name}'s account immediately across the platform.`}
        confirmLabel="Confirm"
        danger={action?.type === 'reject' || action?.type === 'suspend'}
        onConfirm={runAction}
        onCancel={() => setAction(null)}
      />
    </div>
  )
}
