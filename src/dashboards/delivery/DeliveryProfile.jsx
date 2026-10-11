import { useState } from 'react'
import ApprovalBadge from '../../components/ApprovalBadge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { updateUserProfile } from '../../services/dataService'
import { VEHICLE_TYPES, VEHICLE_WEIGHT_LIMIT_KG } from '../../utils/constants'
import AddressLocationField from '../../components/AddressLocationField'

export default function DeliveryProfile() {
  const { user, updateProfile } = useAuth()
  const { refresh } = useAppData()
  const toast = useToast()
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    city: user?.city || '',
    address: user?.address || '',
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
    serviceArea: user?.serviceArea || '',
    vehicleType: user?.vehicleType || VEHICLE_TYPES[0],
    vehicleReg: user?.vehicleReg || '',
  })

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const updateLocation = (patch) => setForm((current) => ({ ...current, ...patch }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (user.backendUser) {
        const result = await updateProfile(form)
        if (!result.ok) throw new Error(result.error)
      } else updateUserProfile(user.id, form)
      toast.success('Profile updated.')
      await refresh()
    } catch (error) { toast.error(error.message || 'Could not update profile.') }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-charcoal">Profile</h1>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-charcoal/60">Application status:</span>
        <ApprovalBadge status={user.approvalStatus} />
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
        <AddressLocationField address={form.address} city={form.city} location={form} onChange={updateLocation} addressLabel="Home/base address" />
        <div>
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
            <p className="mt-1 text-xs text-charcoal/55">Maximum assigned pickup weight: {VEHICLE_WEIGHT_LIMIT_KG[form.vehicleType] ?? 'not set'} kg</p>
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
