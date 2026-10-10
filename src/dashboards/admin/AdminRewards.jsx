import { AlertCircle, Award, Save, Settings } from 'lucide-react'
import { useState } from 'react'
import EmptyState from '../../components/EmptyState'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { resolveComplaint, updatePointsConfig } from '../../services/dataService'
import { formatDateTime } from '../../utils/format'

export default function AdminRewards() {
  const { db, refresh } = useAppData()
  const toast = useToast()
  const [rates, setRates] = useState(db.config.pointsPerKg)

  const handleSaveRates = (e) => {
    e.preventDefault()
    updatePointsConfig(Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, Number(v)])))
    toast.success('Points-per-kg rules updated.')
    refresh()
  }

  const toggleComplaint = (id) => {
    resolveComplaint(id)
    refresh()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Rewards & configuration</h1>
        <p className="mt-1 text-charcoal/60">Set reward rates, review the coupon catalog, and resolve complaints.</p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-emerald-100/70">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Settings size={16} /> Points per kilogram by category
        </h2>
        <form onSubmit={handleSaveRates} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(rates).map(([category, rate]) => (
            <div key={category}>
              <label className="mb-1 block text-sm font-medium text-charcoal">{category}</label>
              <input
                type="number"
                min="1"
                value={rate}
                onChange={(e) => setRates((r) => ({ ...r, [category]: e.target.value }))}
                className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
          ))}
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button type="submit" className="flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
              <Save size={16} /> Save rates
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Award size={16} /> Coupon catalog
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {db.coupons.map((c) => (
            <div key={c.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
              <span className="rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-medium text-forest">{c.category}</span>
              <h3 className="mt-3 font-semibold text-charcoal">{c.title}</h3>
              <p className="text-xs text-charcoal/50">{c.partner}</p>
              <p className="mt-2 text-sm font-bold text-charcoal">{c.pointsCost.toLocaleString()} pts</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <AlertCircle size={16} /> Complaints
        </h2>
        {db.complaints.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={AlertCircle} title="No complaints" description="Resident and partner complaints will appear here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm border border-emerald-100/70">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                  <th className="px-5 py-3">Submitted by</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {db.complaints.map((c) => (
                  <tr key={c.id} className="border-b border-emerald-50 last:border-0">
                    <td className="px-5 py-3 text-charcoal">{c.user}</td>
                    <td className="px-5 py-3 text-charcoal/70">{c.subject}</td>
                    <td className="px-5 py-3 text-charcoal/50">{formatDateTime(c.createdAt)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-700'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button type="button" onClick={() => toggleComplaint(c.id)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-mint-light">
                        Mark as {c.status === 'resolved' ? 'open' : 'resolved'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
