import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Pagination from './Pagination'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { createComplaint, deleteComplaint } from '../services/dataService'
import { backendEnabled, createBackendComplaint, deleteBackendComplaint } from '../services/backendApi'
import { formatDateTime } from '../utils/format'

export default function ReportComplaint() {
  const { user } = useAuth()
  const { db, refresh } = useAppData()
  const toast = useToast()
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showComplaintHistory, setShowComplaintHistory] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const myComplaints = (db.complaints || [])
    .filter((complaint) => complaint.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const historyPages = Math.max(1, Math.ceil(myComplaints.length / 8))
  const safeHistoryPage = Math.min(historyPage, historyPages)

  useEffect(() => {
    if (!backendEnabled) return undefined
    const interval = window.setInterval(refresh, 15000)
    return () => window.clearInterval(interval)
  }, [refresh])

  const submitComplaint = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      if (backendEnabled) await createBackendComplaint({ subject, details })
      else {
        const result = createComplaint(user.id, { subject, details })
        if (!result.ok) throw new Error(result.error)
      }
      setSubject('')
      setDetails('')
      toast.success('Your complaint was submitted.')
      refresh()
    } catch (error) {
      toast.error(error.message || 'Could not submit your complaint.')
    } finally {
      setSubmitting(false)
    }
  }

  const removeComplaint = async (complaint) => {
    if (complaint.status !== 'open') return
    if (!window.confirm(`Delete your open complaint “${complaint.subject}”?`)) return
    try {
      if (backendEnabled) await deleteBackendComplaint(complaint.id)
      else {
        const result = deleteComplaint(complaint.id, user.id)
        if (!result.ok) throw new Error(result.error)
      }
      toast.success('Your complaint was deleted.')
      refresh()
    } catch (error) {
      toast.error(error.message || 'Could not delete your complaint.')
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-100/70 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-charcoal">Report an issue</h2>
      <p className="mt-1 text-sm text-charcoal/60">Send a complaint to the ReVive admin team.</p>
      <form onSubmit={submitComplaint} className="mt-4 grid gap-3">
        <input
          required minLength={3} maxLength={120} value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Subject"
          aria-label="Complaint subject"
          className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
        <textarea
          required minLength={5} maxLength={2000} rows={3} value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Describe the issue"
          aria-label="Complaint details"
          className="w-full resize-y rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
        <button disabled={submitting} type="submit" className="justify-self-start rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit complaint'}
        </button>
      </form>
      {myComplaints.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-charcoal">Recent complaints</h3>
            {myComplaints.length > 2 && (
              <button type="button" onClick={() => setShowComplaintHistory((show) => !show)} className="text-sm font-semibold text-forest hover:text-forest-dark">
                {showComplaintHistory ? 'Hide complaint history' : 'View complaint history'}
              </button>
            )}
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-emerald-100/70">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                  <th className="px-4 py-3">Complaint</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {(showComplaintHistory ? myComplaints.slice((safeHistoryPage - 1) * 8, safeHistoryPage * 8) : myComplaints.slice(0, 2)).map((complaint) => (
                  <tr key={complaint.id} className="border-b border-emerald-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-charcoal">{complaint.subject}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-charcoal/50">{formatDateTime(complaint.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${complaint.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {complaint.status === 'resolved' ? 'Resolved' : 'Open'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {complaint.status === 'open' && (
                        <button type="button" onClick={() => removeComplaint(complaint)} aria-label={`Delete complaint: ${complaint.subject}`} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showComplaintHistory && <Pagination page={safeHistoryPage} totalPages={historyPages} onChange={setHistoryPage} />}
        </div>
      )}
    </section>
  )
}
