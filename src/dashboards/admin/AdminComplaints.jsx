import { AlertCircle, CheckCircle2 } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import { useAppData } from '../../context/AppDataContext'
import { useState } from 'react'
import Pagination from '../../components/Pagination'
import { useToast } from '../../context/ToastContext'
import { resolveComplaint } from '../../services/dataService'
import { backendEnabled, updateBackendComplaint } from '../../services/backendApi'
import { formatDateTime } from '../../utils/format'

const roleLabels = {
  user: 'Resident', resident: 'Resident',
  center: 'Recycling center', 'recycling center': 'Recycling center',
  delivery: 'Delivery partner', partner: 'Delivery partner', 'delivery partner': 'Delivery partner',
  admin: 'Admin',
}

function getSenderType(complaint) {
  const role = String(complaint.accountRole ?? complaint.accountType ?? complaint.role ?? complaint.userRole ?? '').toLowerCase().replaceAll('_', ' ')
  return roleLabels[role] || 'Resident or partner'
}

export default function AdminComplaints() {
  const { db, refresh } = useAppData()
  const toast = useToast()
  const [openPage, setOpenPage] = useState(1)
  const [resolvedPage, setResolvedPage] = useState(1)
  const complaints = [...(db.complaints || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const open = complaints.filter((complaint) => complaint.status !== 'resolved')
  const resolved = complaints.filter((complaint) => complaint.status === 'resolved')

  const toggleStatus = async (complaint) => {
    const status = complaint.status === 'resolved' ? 'open' : 'resolved'
    try {
      if (backendEnabled) await updateBackendComplaint(complaint.id, status)
      else {
        const result = resolveComplaint(complaint.id)
        if (!result.ok) throw new Error(result.error)
      }
      toast.success(status === 'resolved' ? 'Complaint marked as resolved.' : 'Complaint reopened.')
      refresh()
    } catch (error) {
      toast.error(error.message || 'Could not update complaint status.')
    }
  }

  const renderComplaintList = (items, emptyTitle, page, setPage) => items.length === 0 ? (
    <div className="mt-3 rounded-2xl border border-emerald-100/70 bg-white p-4">
      <EmptyState icon={AlertCircle} title={emptyTitle} description="Complaints will appear here when submitted." />
    </div>
  ) : (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-emerald-100/70 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
            <th className="px-5 py-3">Submitted by</th>
            <th className="px-5 py-3">Complaint</th>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.slice((page - 1) * 10, page * 10).map((complaint) => (
            <tr key={complaint.id} className="border-b border-emerald-50 last:border-0">
              <td className="px-5 py-4">
                <p className="font-medium text-charcoal">{complaint.user || complaint.accountName || 'Resident or partner'}</p>
                <p className="mt-0.5 text-xs text-charcoal/50">{getSenderType(complaint)}</p>
              </td>
              <td className="px-5 py-4 text-charcoal/70">
                <p className="font-medium text-charcoal">{complaint.subject}</p>
                {complaint.details && <p className="mt-1 max-w-2xl whitespace-pre-wrap text-xs text-charcoal/55">{complaint.details}</p>}
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-charcoal/50">{formatDateTime(complaint.createdAt)}</td>
              <td className="px-5 py-4">
                <button type="button" onClick={() => toggleStatus(complaint)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-mint-light">
                  Mark as {complaint.status === 'resolved' ? 'open' : 'resolved'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 pb-5">
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(items.length / 10))} onChange={setPage} />
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Complaints</h1>
        <p className="mt-1 text-charcoal/60">Review new reports, update their status, and keep senders informed.</p>
      </div>
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <AlertCircle size={16} /> Open complaints <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{open.length}</span>
        </h2>
        {renderComplaintList(open, 'No open complaints', Math.min(openPage, Math.max(1, Math.ceil(open.length / 10))), setOpenPage)}
      </section>
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <CheckCircle2 size={16} /> Resolved complaints <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">{resolved.length}</span>
        </h2>
        {renderComplaintList(resolved, 'No resolved complaints', Math.min(resolvedPage, Math.max(1, Math.ceil(resolved.length / 10))), setResolvedPage)}
      </section>
    </div>
  )
}
