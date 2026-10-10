import { Check, Clock, MapPin, Star } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { calculateEstimatedPoints, createPickupRequest, getCentersForCategory } from '../../services/dataService'
import { WASTE_CATEGORIES } from '../../utils/constants'

const STEPS = ['Waste details', 'Pickup info', 'Choose center', 'Review']

export default function UserSchedulePickup() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(null)

  const [form, setForm] = useState({
    wasteCategory: WASTE_CATEGORIES[0],
    quantityKg: '',
    pickupAddress: user?.address || '',
    date: '',
    time: '',
    instructions: '',
    centerId: '',
  })

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const matchingCenters = getCentersForCategory(form.wasteCategory)
  const selectedCenter = matchingCenters.find((c) => c.id === form.centerId) || matchingCenters[0]
  const estimatedPoints = calculateEstimatedPoints(form.wasteCategory, Number(form.quantityKg || 0))

  const validateStep = () => {
    setError('')
    if (step === 0) {
      if (!form.quantityKg || Number(form.quantityKg) <= 0) {
        setError('Enter an approximate quantity greater than zero.')
        return false
      }
    }
    if (step === 1) {
      if (!form.pickupAddress.trim()) return setError('Pickup address is required.'), false
      if (!form.date || !form.time) return setError('Choose a preferred date and time.'), false
    }
    if (step === 2) {
      if (!selectedCenter) return setError('No recycling center accepts this category yet.'), false
    }
    return true
  }

  const handleNext = () => {
    if (!validateStep()) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 0))

  const handleSubmit = () => {
    const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString()
    const result = createPickupRequest({
      userId: user.id,
      wasteCategory: form.wasteCategory,
      quantityKg: form.quantityKg,
      pickupAddress: form.pickupAddress,
      scheduledAt,
      instructions: form.instructions,
      centerId: selectedCenter.id,
      centerName: selectedCenter.name,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success('Pickup request created!')
    setConfirmed(result.pickup)
  }

  if (confirmed) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm border border-emerald-100">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest/10 text-forest">
          <Check size={28} />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-charcoal">Pickup scheduled!</h1>
        <p className="mt-2 text-charcoal/60">
          Request <span className="font-mono font-semibold text-charcoal">{confirmed.id}</span> has been created.
          A delivery partner will accept it soon. Points are credited only after the center verifies recycling.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/user/track/${confirmed.id}`)}
            className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition"
          >
            Track this pickup
          </button>
          <button
            type="button"
            onClick={() => navigate('/user/my-pickups')}
            className="rounded-xl border border-emerald-200 px-5 py-2.5 text-sm font-semibold text-charcoal hover:bg-mint-light transition"
          >
            View all pickups
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-charcoal">Schedule a pickup</h1>
      <p className="mt-1 text-charcoal/60">Tell us what to collect and where.</p>

      <ol className="mt-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i < step ? 'bg-forest text-white' : i === step ? 'bg-forest text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span className={`hidden text-xs font-medium sm:block ${i <= step ? 'text-charcoal' : 'text-charcoal/40'}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-emerald-100" />}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</div>}

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-charcoal">Waste category</label>
              <div className="flex flex-wrap gap-2">
                {WASTE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, wasteCategory: cat, centerId: '' }))}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      form.wasteCategory === cat ? 'border-forest bg-forest text-white' : 'border-emerald-200 text-charcoal/70 hover:bg-mint-light'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-charcoal">Approximate quantity (kg)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={form.quantityKg}
                onChange={update('quantityKg')}
                className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
            <p className="rounded-xl bg-mint-light px-3.5 py-2.5 text-sm text-forest">
              Estimated reward: <strong>{estimatedPoints} points</strong> (estimate — final points depend on verified weight)
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-charcoal">Pickup address</label>
              <textarea rows={2} value={form.pickupAddress} onChange={update('pickupAddress')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-charcoal">Preferred date</label>
                <input type="date" value={form.date} onChange={update('date')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-charcoal">Preferred time</label>
                <input type="time" value={form.time} onChange={update('time')} className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-charcoal">Instructions (optional)</label>
              <input value={form.instructions} onChange={update('instructions')} placeholder="Gate code, floor, etc." className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {matchingCenters.length === 0 && (
              <p className="text-sm text-charcoal/60">No centers currently accept {form.wasteCategory}. Try a different category.</p>
            )}
            {matchingCenters.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, centerId: c.id }))}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedCenter?.id === c.id ? 'border-forest bg-mint-light' : 'border-emerald-200 hover:bg-mint-light/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-charcoal">{c.name}</span>
                  {i === 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Recommended</span>}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-charcoal/60"><MapPin size={14} /> {c.address}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-charcoal/60"><Clock size={14} /> {c.operatingHours}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-600"><Star size={14} fill="currentColor" /> {c.rating || 'New'}</p>
              </button>
            ))}
          </div>
        )}

        {step === 3 && selectedCenter && (
          <div className="space-y-3 text-sm">
            <Row label="Category" value={form.wasteCategory} />
            <Row label="Quantity" value={`${form.quantityKg} kg`} />
            <Row label="Address" value={form.pickupAddress} />
            <Row label="Scheduled" value={`${form.date} at ${form.time}`} />
            <Row label="Center" value={selectedCenter.name} />
            {form.instructions && <Row label="Instructions" value={form.instructions} />}
            <div className="mt-4 rounded-xl bg-mint-light px-4 py-3 font-semibold text-forest">
              Estimated reward: {estimatedPoints} points (estimate)
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="rounded-xl border border-emerald-200 px-5 py-2.5 text-sm font-semibold text-charcoal disabled:opacity-40 hover:bg-mint-light"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext} className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
              Continue
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
              Confirm pickup request
            </button>
          )}
        </div>
      </div>
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
