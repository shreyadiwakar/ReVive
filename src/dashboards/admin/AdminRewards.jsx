import { AlertCircle, Award, Pencil, Plus, Save, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import EmptyState from '../../components/EmptyState'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { createCoupon, resolveComplaint, updateCoupon, updatePointsConfig } from '../../services/dataService'
import { formatDateTime } from '../../utils/format'
import { backendEnabled, createBackendCoupon, updateBackendCoupon, updateBackendPointsConfig } from '../../services/backendApi'

const initialCouponForm = { title: '', partner: '', pointsCost: '', category: 'Grocery' }

export default function AdminRewards() {
  const { db, refresh } = useAppData()
  const toast = useToast()
  const [rates, setRates] = useState(db.config.pointsPerKg)
  const [couponForm, setCouponForm] = useState(initialCouponForm)
  const [editingCouponId, setEditingCouponId] = useState(null)

  useEffect(() => setRates(db.config.pointsPerKg), [db.config.pointsPerKg])

  const handleSaveRates = async (e) => {
    e.preventDefault()
    try {
      const values = Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, Number(v)]))
      if (backendEnabled) await updateBackendPointsConfig(values)
      else updatePointsConfig(values)
      toast.success('Points-per-kg rules updated.')
      await refresh()
    } catch (error) { toast.error(error.message || 'Could not update reward rates.') }
  }

  const handleCouponSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        title: couponForm.title,
        partner: couponForm.partner,
        pointsCost: Number(couponForm.pointsCost),
        category: couponForm.category,
      }
      if (!payload.title || !payload.partner || !Number.isInteger(payload.pointsCost) || payload.pointsCost <= 0) {
        throw new Error('Add a title, partner, and valid point cost to create the coupon.')
      }
      if (editingCouponId) {
        if (backendEnabled) await updateBackendCoupon(editingCouponId, payload)
        else {
          const result = updateCoupon(editingCouponId, payload)
          if (!result.ok) throw new Error(result.error)
        }
        toast.success('Coupon updated.')
      } else {
        if (backendEnabled) await createBackendCoupon(payload)
        else {
          const result = createCoupon(payload)
          if (!result.ok) throw new Error(result.error)
        }
        toast.success('Coupon added to the admin catalog.')
      }
      setCouponForm(initialCouponForm)
      setEditingCouponId(null)
      await refresh()
    } catch (error) {
      toast.error(error.message || 'Could not add coupon.')
    }
  }

  const toggleCouponActive = async (coupon) => {
    try {
      const nextState = coupon.active === false
      if (backendEnabled) await updateBackendCoupon(coupon.id, { active: nextState })
      else {
        const result = updateCoupon(coupon.id, { active: nextState })
        if (!result.ok) throw new Error(result.error)
      }
      toast.success(`Coupon ${nextState ? 'activated' : 'deactivated'} successfully.`)
      await refresh()
    } catch (error) {
      toast.error(error.message || 'Could not update coupon status.')
    }
  }

  const startEditingCoupon = (coupon) => {
    setEditingCouponId(coupon.id)
    setCouponForm({ title: coupon.title, partner: coupon.partner, pointsCost: String(coupon.pointsCost), category: coupon.category })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelCouponEdit = () => {
    setEditingCouponId(null)
    setCouponForm(initialCouponForm)
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

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-emerald-100/70">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <Award size={16} /> Coupon catalog
          </h2>
          <span className="text-xs text-charcoal/50">{db.coupons.filter((coupon) => coupon.active !== false).length} active listings</span>
        </div>

        <form onSubmit={handleCouponSubmit} className="mt-4 grid gap-3 rounded-2xl border border-dashed border-emerald-200 bg-mint-light/30 p-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal/60">Title</label>
            <input
              type="text"
              value={couponForm.title}
              onChange={(e) => setCouponForm((current) => ({ ...current, title: e.target.value }))}
              placeholder="₹250 Grocery Voucher"
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal/60">Partner</label>
            <input
              type="text"
              value={couponForm.partner}
              onChange={(e) => setCouponForm((current) => ({ ...current, partner: e.target.value }))}
              placeholder="FreshMart"
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal/60">Points cost</label>
            <input
              type="number"
              min="1"
              value={couponForm.pointsCost}
              onChange={(e) => setCouponForm((current) => ({ ...current, pointsCost: e.target.value }))}
              placeholder="2000"
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal/60">Category</label>
            <select
              value={couponForm.category}
              onChange={(e) => setCouponForm((current) => ({ ...current, category: e.target.value }))}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            >
              {['Grocery', 'Shopping', 'Impact', 'Cash', 'Entertainment', 'Food', 'Transport', 'Other'].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end md:col-span-5">
            <button type="submit" className="flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
              {editingCouponId ? <Save size={16} /> : <Plus size={16} />} {editingCouponId ? 'Save changes' : 'Add coupon'}
            </button>
            {editingCouponId && (
              <button type="button" onClick={cancelCouponEdit} className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-white">
                Cancel edit
              </button>
            )}
          </div>
        </form>

        {db.coupons.length === 0 && backendEnabled ? (
          <div className="mt-4"><EmptyState icon={Award} title="No coupons available" description="Seed coupon records in the local database to make rewards redeemable." /></div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {db.coupons.map((c) => (
              <div key={c.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-medium text-forest">{c.category}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                    {c.active === false ? 'Inactive' : 'Active'}
                  </span>
                </div>
                <h3 className="mt-3 font-semibold text-charcoal">{c.title}</h3>
                <p className="text-xs text-charcoal/50">{c.partner}</p>
                <p className="mt-2 text-sm font-bold text-charcoal">{Number(c.pointsCost || 0).toLocaleString()} pts</p>
                <button
                  type="button"
                  onClick={() => startEditingCoupon(c)}
                  className="mt-4 w-full rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-charcoal hover:bg-mint-light"
                >
                  <span className="inline-flex items-center justify-center gap-1.5"><Pencil size={13} /> Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleCouponActive(c)}
                  className="mt-2 w-full rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-charcoal hover:bg-mint-light"
                >
                  {c.active === false ? 'Activate' : 'Deactivate'}
                </button>
              </div>
            ))}
          </div>
        )}
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
