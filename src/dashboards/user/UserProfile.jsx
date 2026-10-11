import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import AddressLocationField from '../../components/AddressLocationField'

export default function UserProfile() {
  const { user, updateProfile } = useAuth()
  const { refresh } = useAppData()
  const toast = useToast()
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
  })
  const [saving, setSaving] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const updateLocation = (patch) => setForm((current) => ({ ...current, ...patch }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const result = await updateProfile(form)
    if (!result.ok) {
      toast.error(result.error)
    } else {
      toast.success('Profile updated.')
      setForm({ name: result.user.name, phone: result.user.phone, address: result.user.address, city: result.user.city, latitude: result.user.latitude ?? null, longitude: result.user.longitude ?? null })
      refresh()
    }
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-charcoal">Profile</h1>
      <p className="mt-1 text-charcoal/60">Keep your contact and pickup details up to date.</p>

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
        <AddressLocationField address={form.address} city={form.city} location={form} onChange={updateLocation} addressLabel="Default pickup address" />
        <button type="submit" disabled={saving} className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition disabled:opacity-60">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
