import { useState } from 'react'
import SimulatedBanner from '../../components/SimulatedBanner'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { updateUserProfile } from '../../services/dataService'

export default function UserProfile() {
  const { user } = useAuth()
  const { refresh } = useAppData()
  const toast = useToast()
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
  })

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    updateUserProfile(user.id, form)
    toast.success('Profile updated.')
    refresh()
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-charcoal">Profile</h1>
      <p className="mt-1 text-charcoal/60">Keep your contact and pickup details up to date.</p>

      <div className="mt-5">
        <SimulatedBanner compact />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">Full name</label>
          <input value={form.name} onChange={update('name')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">Email</label>
          <input value={user?.email} disabled className="w-full rounded-xl border border-emerald-200 bg-slate-50 px-3.5 py-2.5 text-sm text-charcoal/50" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">Phone</label>
          <input value={form.phone} onChange={update('phone')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">Default pickup address</label>
          <textarea rows={2} value={form.address} onChange={update('address')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">City</label>
          <input value={form.city} onChange={update('city')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
        </div>
        <button type="submit" className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
          Save changes
        </button>
      </form>
    </div>
  )
}
