import { Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import ApprovalBadge from '../../components/ApprovalBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { setAccountStatus } from '../../services/dataService'
import { backendEnabled, updateBackendAdminAccount } from '../../services/backendApi'
import { ACCOUNT_STATUS, ROLE_OPTIONS, getRoleLabel, ROLES } from '../../utils/constants'
import { formatDate } from '../../utils/format'

const PAGE_SIZE = 8

export default function AdminUsers() {
  const { db, refresh, error, loading } = useAppData()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState(null)
  const [suspendTarget, setSuspendTarget] = useState(null)

  const filtered = useMemo(() => {
    return db.users
      .filter((u) => roleFilter === 'All' || u.role === roleFilter)
      .filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [db.users, roleFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleToggleStatus = async () => {
    const nextStatus = suspendTarget.status === ACCOUNT_STATUS.SUSPENDED ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.SUSPENDED
    try {
      if (backendEnabled) await updateBackendAdminAccount(suspendTarget.id, { status: nextStatus })
      else setAccountStatus(suspendTarget.id, nextStatus)
      toast.success(`${suspendTarget.name} is now ${nextStatus}.`)
      setSuspendTarget(null)
      await refresh()
    } catch (reason) { toast.error(reason.message || 'Could not update account status.') }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Users</h1>
      <p className="mt-1 text-charcoal/60">Residents, delivery partners, centers, and admins.</p>
      {backendEnabled && loading && <p className="mt-3 text-sm text-charcoal/60">Loading accounts…</p>}
      {backendEnabled && error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/40" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or email"
            className="w-full rounded-xl border border-emerald-200 py-2.5 pl-10 pr-3.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        >
          <option value="All">All roles</option>
          {ROLE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {pageItems.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Users} title="No users found" description="Try a different search or filter." />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm border border-emerald-100/70">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Points</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((u) => (
                <tr key={u.id} className="border-b border-emerald-50 last:border-0">
                  <td className="px-5 py-3 text-charcoal">{u.name}</td>
                  <td className="px-5 py-3 text-charcoal/70">{u.email}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className="inline-flex w-max flex-nowrap items-center whitespace-nowrap rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-medium text-forest">{getRoleLabel(u.role)}</span>
                  </td>
                  <td className="px-5 py-3 text-charcoal/70">{u.role === ROLES.USER ? Number(u.points ?? 0).toLocaleString() : '—'}</td>
                  <td className="px-5 py-3"><ApprovalBadge status={u.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setViewing(u)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-mint-light">
                        View
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => setSuspendTarget(u)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                            u.status === ACCOUNT_STATUS.SUSPENDED ? 'border-emerald-200 text-forest hover:bg-mint-light' : 'border-red-200 text-red-700 hover:bg-red-50'
                          }`}
                        >
                          {u.status === ACCOUNT_STATUS.SUSPENDED ? 'Activate' : 'Suspend'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 pb-5">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}

      <Modal open={!!viewing} title={viewing?.name} onClose={() => setViewing(null)}>
        {viewing && (
          <div className="space-y-2 text-sm">
            <Row label="Email" value={viewing.email} />
            <Row label="Role" value={getRoleLabel(viewing.role)} />
            <Row label="Phone" value={viewing.phone || '—'} />
            <Row label="City" value={viewing.city || '—'} />
            <Row label="Joined" value={formatDate(viewing.createdAt)} />
            {viewing.role === ROLES.USER && <Row label="Points" value={Number(viewing.points ?? 0).toLocaleString()} />}
            {viewing.approvalStatus && <Row label="Approval" value={viewing.approvalStatus} />}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!suspendTarget}
        title={suspendTarget?.status === ACCOUNT_STATUS.SUSPENDED ? 'Activate this account?' : 'Suspend this account?'}
        message={`${suspendTarget?.name} will ${suspendTarget?.status === ACCOUNT_STATUS.SUSPENDED ? 'regain' : 'lose'} access to restricted operations immediately.`}
        confirmLabel={suspendTarget?.status === ACCOUNT_STATUS.SUSPENDED ? 'Activate' : 'Suspend'}
        danger={suspendTarget?.status !== ACCOUNT_STATUS.SUSPENDED}
        onConfirm={handleToggleStatus}
        onCancel={() => setSuspendTarget(null)}
      />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-emerald-50 pb-2">
      <span className="text-charcoal/50">{label}</span>
      <span className="font-medium text-charcoal">{value}</span>
    </div>
  )
}
