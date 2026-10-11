import { Factory } from 'lucide-react'
import { useState } from 'react'
import ApprovalBadge from '../../components/ApprovalBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { setAccountStatus, setApprovalStatus } from '../../services/dataService'
import { backendEnabled, updateBackendAdminAccount } from '../../services/backendApi'
import { ACCOUNT_STATUS, APPROVAL_STATUS, ROLES } from '../../utils/constants'
import { formatDate } from '../../utils/format'

export default function AdminCenters() {
  const { db, refresh, error, loading } = useAppData()
  const toast = useToast()
  const [action, setAction] = useState(null)

  const centers = db.users
    .filter((u) => u.role === ROLES.CENTER)
    .sort((a) => (a.approvalStatus === APPROVAL_STATUS.PENDING ? -1 : 1))

  const runAction = async () => {
    try {
      if (backendEnabled) {
        if (action.type === 'approve') await updateBackendAdminAccount(action.user.id, { approvalStatus: APPROVAL_STATUS.APPROVED })
        if (action.type === 'reject') await updateBackendAdminAccount(action.user.id, { approvalStatus: APPROVAL_STATUS.REJECTED })
        if (action.type === 'suspend') await updateBackendAdminAccount(action.user.id, { status: ACCOUNT_STATUS.SUSPENDED })
        if (action.type === 'activate') await updateBackendAdminAccount(action.user.id, { status: ACCOUNT_STATUS.ACTIVE })
      } else {
        if (action.type === 'approve') setApprovalStatus(action.user.id, APPROVAL_STATUS.APPROVED)
        if (action.type === 'reject') setApprovalStatus(action.user.id, APPROVAL_STATUS.REJECTED)
        if (action.type === 'suspend') setAccountStatus(action.user.id, ACCOUNT_STATUS.SUSPENDED)
        if (action.type === 'activate') setAccountStatus(action.user.id, ACCOUNT_STATUS.ACTIVE)
      }
      toast.success(`${action.user.name} updated.`)
      setAction(null)
      await refresh()
    } catch (reason) { toast.error(reason.message || 'Could not update center application.') }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Recycling centers</h1>
      <p className="mt-1 text-charcoal/60">Approve partner facilities and monitor their status.</p>
      {backendEnabled && loading && <p className="mt-3 text-sm text-charcoal/60">Loading center applications…</p>}
      {backendEnabled && error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

      {centers.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Factory} title="No recycling centers" description="Applications will appear here once submitted." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {centers.map((c) => (
            <div key={c.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-charcoal">{c.name}</p>
                  <p className="text-sm text-charcoal/60">{c.email} · {c.contactPerson}</p>
                  <p className="mt-1 text-sm text-charcoal/60">{c.address}, {c.city}</p>
                  <p className="text-sm text-charcoal/50">Accepts: {c.acceptedCategories?.join(', ')} · Applied {formatDate(c.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ApprovalBadge status={c.approvalStatus} />
                  <ApprovalBadge status={c.status} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {c.approvalStatus === APPROVAL_STATUS.PENDING && (
                  <>
                    <button type="button" onClick={() => setAction({ type: 'approve', user: c })} className="rounded-lg bg-forest px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-forest-dark">
                      Approve
                    </button>
                    <button type="button" onClick={() => setAction({ type: 'reject', user: c })} className="rounded-lg border border-red-200 px-3.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                      Reject
                    </button>
                  </>
                )}
                {c.approvalStatus === APPROVAL_STATUS.APPROVED && (
                  <button
                    type="button"
                    onClick={() => setAction({ type: c.status === ACCOUNT_STATUS.SUSPENDED ? 'activate' : 'suspend', user: c })}
                    className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold ${
                      c.status === ACCOUNT_STATUS.SUSPENDED ? 'border-emerald-200 text-forest hover:bg-mint-light' : 'border-red-200 text-red-700 hover:bg-red-50'
                    }`}
                  >
                    {c.status === ACCOUNT_STATUS.SUSPENDED ? 'Activate' : 'Suspend'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!action}
        title={`${action?.type?.charAt(0).toUpperCase()}${action?.type?.slice(1)} this center?`}
        message={`This will update ${action?.user?.name}'s account immediately across the platform.`}
        confirmLabel="Confirm"
        danger={action?.type === 'reject' || action?.type === 'suspend'}
        onConfirm={runAction}
        onCancel={() => setAction(null)}
      />
    </div>
  )
}
