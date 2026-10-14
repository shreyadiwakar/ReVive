import { Check, Clock, MapPin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { calculateEstimatedPoints, createPickupRequest } from '../../services/dataService'
import { useAppData } from '../../context/AppDataContext'
import { backendEnabled, createBackendPickup } from '../../services/backendApi'
import { WASTE_CATEGORIES } from '../../utils/constants'
import AddressLocationField from '../../components/AddressLocationField'
import CenterMap from '../../components/CenterMap'
import Pagination from '../../components/Pagination'
import { getDrivingDistances, haversineKm, isValidLocation } from '../../services/mapServices'

const STEPS = ['Waste details', 'Pickup info', 'Choose center', 'Review']

export default function UserSchedulePickup() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { db, refresh, loading, error: dataError } = useAppData()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(null)
  const [centerDistances, setCenterDistances] = useState(new Map())
  const [routing, setRouting] = useState(false)
  const [centerPage, setCenterPage] = useState(1)

  const [form, setForm] = useState({
    wasteCategory: WASTE_CATEGORIES[0],
    quantityKg: '',
    pickupAddress: user?.address || '',
    pickupCity: user?.city || '',
    latitude: null,
    longitude: null,
    date: '',
    time: '',
    instructions: '',
    centerId: '',
  })

  const pickupLocation = { latitude: form.latitude, longitude: form.longitude }

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const updatePickupLocation = (patch) => {
    const normalized = { ...patch }
    if (Object.hasOwn(normalized, 'address')) normalized.pickupAddress = normalized.address
    if (Object.hasOwn(normalized, 'city')) normalized.pickupCity = normalized.city
    delete normalized.address
    delete normalized.city

    setForm((current) => ({
      ...current,
      ...normalized,
      ...(Object.hasOwn(normalized, 'latitude') ? { latitude: normalized.latitude } : {}),
      ...(Object.hasOwn(normalized, 'longitude') ? { longitude: normalized.longitude } : {}),
    }))
  }

  const matchingCenters = useMemo(() => db.centers.filter((center) =>
    center.available && center.acceptedCategories?.includes(form.wasteCategory)), [db.centers, form.wasteCategory])
  const rankedCenters = useMemo(() => [...matchingCenters].sort((a, b) =>
    (centerDistances.get(a.id)?.km ?? Infinity) - (centerDistances.get(b.id)?.km ?? Infinity)), [matchingCenters, centerDistances])
  const centersPerPage = 5
  const centerPageCount = Math.max(1, Math.ceil(rankedCenters.length / centersPerPage))
  const safeCenterPage = Math.min(centerPage, centerPageCount)
  const rankedPageCenters = rankedCenters.slice((safeCenterPage - 1) * centersPerPage, safeCenterPage * centersPerPage)
  const recommendedCenter = rankedCenters.find((center) => centerDistances.has(center.id))
  const selectedCenter = matchingCenters.find((c) => c.id === form.centerId) || recommendedCenter
  const selectedCenterDistance = selectedCenter && isValidLocation(pickupLocation) && isValidLocation(selectedCenter)
    ? (centerDistances.get(selectedCenter.id) ?? { km: haversineKm(pickupLocation, selectedCenter), kind: 'straight' })
    : null
  const estimatedPoints = calculateEstimatedPoints(form.wasteCategory, Number(form.quantityKg || 0))

  useEffect(() => {
    let active = true
    if (step !== 2 || !isValidLocation(pickupLocation)) return () => { active = false }
    const destinations = matchingCenters.map((center) => ({ id: center.id, location: center }))
    const estimate = new Map(destinations.filter(({ location }) => isValidLocation(location)).map(({ id, location }) => [id, {
      km: haversineKm(pickupLocation, location), kind: 'straight',
    }]))
    setCenterDistances(estimate)
    setRouting(true)
    getDrivingDistances(pickupLocation, destinations).then((distances) => {
      if (!active) return
      setCenterDistances(distances)
      const nearest = [...matchingCenters].filter((center) => distances.has(center.id))
        .sort((a, b) => distances.get(a.id).km - distances.get(b.id).km)[0]
      if (nearest && !form.centerId) setForm((current) => ({ ...current, centerId: nearest.id }))
    }).finally(() => { if (active) setRouting(false) })
    return () => { active = false }
  }, [step, pickupLocation.latitude, pickupLocation.longitude, matchingCenters])

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
      if (!form.pickupCity.trim()) return setError('Pickup city is required so the address can be matched accurately.'), false
      if (!isValidLocation(pickupLocation)) return setError('Pin the pickup location on the map so centers can be recommended and the delivery partner can find you.'), false
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

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString()
      const pickupAddress = form.pickupCity && !form.pickupAddress.toLowerCase().includes(form.pickupCity.toLowerCase())
        ? `${form.pickupAddress}, ${form.pickupCity}` : form.pickupAddress
      const payload = { userId: user.id, wasteCategory: form.wasteCategory, quantityKg: form.quantityKg,
        pickupAddress, scheduledAt, instructions: form.instructions,
        pickupLatitude: form.latitude, pickupLongitude: form.longitude,
        centerId: selectedCenter.id, centerName: selectedCenter.name, residentName: user.name }
      if (backendEnabled) {
        const pickup = await createBackendPickup(payload)
        setConfirmed(pickup)
        await refresh()
      } else {
        const result = createPickupRequest(payload)
        if (!result.ok) throw new Error(result.error)
        setConfirmed(result.pickup)
      }
      toast.success('Pickup request created!')
    } catch (reason) { toast.error(reason.message || 'Could not create pickup request.') }
    finally { setSaving(false) }
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
        {backendEnabled && dataError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{dataError}</div>}
        {backendEnabled && loading && <p className="mb-4 text-sm text-charcoal/60">Loading recycling centers…</p>}
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
            <p className="text-xs text-charcoal/55">Include the building number, street, area, and a nearby landmark so the delivery partner can find you.</p>
            <AddressLocationField address={form.pickupAddress} city={form.pickupCity} location={pickupLocation} onChange={updatePickupLocation} addressLabel="Full pickup address" />
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
            {isValidLocation(pickupLocation) && <CenterMap centers={matchingCenters.filter((center) => isValidLocation(center))} userLocation={pickupLocation} selectedCenterId={selectedCenter?.id} onSelect={(id) => setForm((current) => ({ ...current, centerId: id }))} />}
            <p className="text-xs text-charcoal/55">Recommendations are ranked by driving distance from your pickup pin. Routing falls back to a straight-line estimate if road routing is unavailable.</p>
            {routing && <p className="text-sm text-charcoal/60">Calculating center distances…</p>}
            {matchingCenters.length === 0 && (
              <p className="text-sm text-charcoal/60">No centers currently accept {form.wasteCategory}. Try a different category.</p>
            )}
            {rankedPageCenters.map((c) => {
              const centerDistance = isValidLocation(pickupLocation) && isValidLocation(c)
                ? (centerDistances.get(c.id) ?? { km: haversineKm(pickupLocation, c), kind: 'straight' })
                : null
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!centerDistance}
                  onClick={() => setForm((f) => ({ ...f, centerId: c.id }))}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selectedCenter?.id === c.id ? 'border-forest bg-mint-light' : 'border-emerald-200 hover:bg-mint-light/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-charcoal">{c.name}</span>
                    {recommendedCenter?.id === c.id && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Nearest recommended</span>}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-charcoal/60"><MapPin size={14} /> {c.address}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-charcoal/60"><Clock size={14} /> {c.operatingHours}</p>
                  {centerDistance ? (
                    <div className="mt-3 inline-flex flex-col rounded-lg bg-mint-light px-3 py-2">
                      <span className="text-lg font-bold text-forest">{centerDistance.km.toFixed(1)} km</span>
                      <span className="text-xs text-charcoal/60">Pickup to center · {centerDistance.kind === 'road' ? 'by road' : 'straight-line estimate'}</span>
                    </div>
                  ) : <p className="mt-1 text-sm font-medium text-amber-800">Distance unavailable: this center needs a saved map pin.</p>}
                </button>
              )
            })}
            <Pagination page={safeCenterPage} totalPages={centerPageCount} onChange={setCenterPage} />
          </div>
        )}

        {step === 3 && selectedCenter && (
          <div className="space-y-3 text-sm">
            <Row label="Category" value={form.wasteCategory} />
            <Row label="Quantity" value={`${form.quantityKg} kg`} />
            <Row label="Address" value={form.pickupAddress} />
            <Row label="Scheduled" value={`${form.date} at ${form.time}`} />
            <Row label="Center" value={selectedCenter.name} />
            {selectedCenterDistance && <Row label="Distance" value={`${selectedCenterDistance.km.toFixed(1)} km · ${selectedCenterDistance.kind === 'road' ? 'by road' : 'straight-line estimate'}`} />}
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
            <button type="button" disabled={saving || (backendEnabled && loading)} onClick={handleSubmit} className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-forest-dark transition">
              {saving ? 'Submitting…' : 'Confirm pickup request'}
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
