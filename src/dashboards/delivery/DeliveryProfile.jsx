import { useState } from 'react'
import ApprovalBadge from '../../components/ApprovalBadge'
import SimulatedBanner from '../../components/SimulatedBanner'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { updateUserProfile } from '../../services/dataService'
import { VEHICLE_TYPES } from '../../utils/constants'

export default function DeliveryProfile() {
  const { user } = useAuth()
  const { refresh } = useAppData()
  const toast = useToast()
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    city: user?.city || '',
    serviceArea: user?.serviceArea || '',
    vehicleType: user?.vehicleType || VEHICLE_TYPES[0],
    vehicleReg: user?.vehicleReg || '',
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
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-charcoal/60">Application status:</span>
        <ApprovalBadge status={user.approvalStatus} />
        <span className="text-sm text-charcoal/60">Identity verified:</span>
        <ApprovalBadge status={user.identityVerified ? 'approved' : 'pending'} />
      </div>

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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">City</label>
            <input value={form.city} onChange={update('city')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">Service area</label>
            <input value={form.serviceArea} onChange={update('serviceArea')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">Vehicle type</label>
            <select value={form.vehicleType} onChange={update('vehicleType')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20">
              {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">Vehicle registration</label>
            <input value={form.vehicleReg} onChange={update('vehicleReg')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
          </div>
        </div>
        <button type="submit" className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
          Save changes
        </button>
      </form>
    </div>
  )
}
