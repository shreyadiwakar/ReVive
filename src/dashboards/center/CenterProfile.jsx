import { useState } from 'react'
import ApprovalBadge from '../../components/ApprovalBadge'
import SimulatedBanner from '../../components/SimulatedBanner'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { updateUserProfile } from '../../services/dataService'
import { WASTE_CATEGORIES } from '../../utils/constants'

export default function CenterProfile() {
  const { user } = useAuth()
  const { refresh } = useAppData()
  const toast = useToast()
  const [form, setForm] = useState({
    name: user?.name || '',
    contactPerson: user?.contactPerson || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    operatingHours: user?.operatingHours || '',
    description: user?.description || '',
    acceptedCategories: user?.acceptedCategories || [],
  })

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const toggleCategory = (cat) => {
    setForm((f) => ({
      ...f,
      acceptedCategories: f.acceptedCategories.includes(cat)
        ? f.acceptedCategories.filter((c) => c !== cat)
        : [...f.acceptedCategories, cat],
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    updateUserProfile(user.id, form)
    toast.success('Center profile updated.')
    refresh()
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-charcoal">Center profile</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-charcoal/60">Application status:</span>
        <ApprovalBadge status={user.approvalStatus} />
        <span className="text-sm text-charcoal/60">Business verification:</span>
        <ApprovalBadge status={user.businessVerified ? 'approved' : 'pending'} />
      </div>

      <div className="mt-5">
        <SimulatedBanner compact />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">Facility name</label>
          <input value={form.name} onChange={update('name')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">Contact person</label>
            <input value={form.contactPerson} onChange={update('contactPerson')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">Phone</label>
            <input value={form.phone} onChange={update('phone')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">Address</label>
          <textarea rows={2} value={form.address} onChange={update('address')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">City</label>
            <input value={form.city} onChange={update('city')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">Operating hours</label>
            <input value={form.operatingHours} onChange={update('operatingHours')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">Description</label>
          <textarea rows={3} value={form.description} onChange={update('description')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal">Accepted waste categories</label>
          <div className="flex flex-wrap gap-2">
            {WASTE_CATEGORIES.map((cat) => {
              const active = form.acceptedCategories.includes(cat)
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    active ? 'border-forest bg-forest text-white' : 'border-emerald-200 text-charcoal/70 hover:bg-mint-light'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>
        <button type="submit" className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
          Save changes
        </button>
      </form>
    </div>
  )
}
