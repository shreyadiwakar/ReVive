import { ArrowLeft, FileCheck2, Factory, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SimulatedBanner from '../../components/SimulatedBanner'
import AddressLocationField from '../../components/AddressLocationField'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ROLES, WASTE_CATEGORIES } from '../../utils/constants'
import { isValidLocation } from '../../services/mapServices'
import { isValidEmail, isValidPhone, required, validatePasswordMatch } from '../../utils/validation'
import { Field, inputClass } from './formHelpers'

const EMPTY = {
  centerName: '',
  contactPerson: '',
  email: '',
  phone: '',
  password: '',
  confirm: '',
  address: '',
  city: '',
  latitude: null,
  longitude: null,
  acceptedCategories: [],
  operatingHours: '',
  description: '',
  terms: false,
}

export default function RegisterCenter() {
  const { registerAndLogin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const update = (field) => (e) => {
    const value = field === 'terms' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }
  const updateAddressLocation = (patch) => setForm((current) => ({ ...current, ...patch }))

  const toggleCategory = (cat) => {
    setForm((f) => ({
      ...f,
      acceptedCategories: f.acceptedCategories.includes(cat)
        ? f.acceptedCategories.filter((c) => c !== cat)
        : [...f.acceptedCategories, cat],
    }))
  }

  const validate = () => {
    const next = {}
    if (!required(form.centerName)) next.centerName = 'Center name is required.'
    if (!required(form.contactPerson)) next.contactPerson = 'Contact person is required.'
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.'
    if (!isValidPhone(form.phone)) next.phone = 'Enter a valid phone number.'
    if (!validatePasswordMatch(form.password, form.confirm)) next.confirm = 'Passwords must match and be at least 8 characters.'
    if (!required(form.address)) next.address = 'Complete address is required.'
    if (!required(form.city)) next.city = 'City is required.'
    if (!isValidLocation(form)) next.location = 'Pin the facility location on the map.'
    if (form.acceptedCategories.length === 0) next.acceptedCategories = 'Select at least one accepted waste category.'
    if (!required(form.operatingHours)) next.operatingHours = 'Operating hours are required.'
    if (!required(form.description)) next.description = 'Add a short description of your facility.'
    if (!form.terms) next.terms = 'You must accept the terms to continue.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return
    const result = await registerAndLogin(ROLES.CENTER, form)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    toast.success('Application submitted — pending admin approval.')
    navigate('/center/dashboard')
  }

  return (
    <div className="min-h-screen bg-mint-light px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm border border-emerald-100">
        <Link to="/register" className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-forest">
          <ArrowLeft size={16} /> Choose a different role
        </Link>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-light text-forest">
            <Factory size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-charcoal">Register a recycling center</h1>
            <p className="text-sm text-charcoal/60">Applications are reviewed by the ReVive team.</p>
          </div>
        </div>

        {formError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Center name" error={errors.centerName}>
              <input value={form.centerName} onChange={update('centerName')} className={inputClass(errors.centerName)} />
            </Field>
            <Field label="Contact person" error={errors.contactPerson}>
              <input value={form.contactPerson} onChange={update('contactPerson')} className={inputClass(errors.contactPerson)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={update('email')} className={inputClass(errors.email)} />
            </Field>
            <Field label="Phone number" error={errors.phone}>
              <input value={form.phone} onChange={update('phone')} placeholder="+91 98765 43210" className={inputClass(errors.phone)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" error={errors.confirm}>
              <input type="password" value={form.password} onChange={update('password')} className={inputClass(errors.confirm)} />
            </Field>
            <Field label="Confirm password">
              <input type="password" value={form.confirm} onChange={update('confirm')} className={inputClass(errors.confirm)} />
            </Field>
          </div>
          <AddressLocationField address={form.address} city={form.city} location={form} onChange={updateAddressLocation} addressLabel="Complete address" addressError={errors.address} cityError={errors.city} locationError={errors.location} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Operating hours" error={errors.operatingHours}>
              <input value={form.operatingHours} onChange={update('operatingHours')} placeholder="Mon–Sat 8am–8pm" className={inputClass(errors.operatingHours)} />
            </Field>
          </div>
          <Field label="Accepted waste categories" error={errors.acceptedCategories}>
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
          </Field>

          <Field label="Center description" error={errors.description}>
            <textarea rows={3} value={form.description} onChange={update('description')} placeholder="Tell residents what makes your facility reliable" className={inputClass(errors.description)} />
          </Field>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
            <FileCheck2 size={18} className="mt-0.5 shrink-0" />
            <span>Business verification document: not yet uploaded. You'll be prompted to attach your registration certificate during review (simulated).</span>
          </div>

          <label className="flex items-start gap-2 text-sm text-charcoal/70">
            <input type="checkbox" checked={form.terms} onChange={update('terms')} className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-forest" />
            I agree to the ReVive partner terms and simulated data handling for this demo.
          </label>
          {errors.terms && <p className="text-xs text-red-600">{errors.terms}</p>}

          <button type="submit" className="w-full rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
            Submit application
          </button>
        </form>

        <div className="mt-5">
          <SimulatedBanner compact />
        </div>
        <p className="mt-3 text-center text-sm text-charcoal/60">
          Already have an account? <Link to="/login" className="font-semibold text-forest hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
