import { ArrowLeft, ShieldAlert, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { awsApiEnabled } from '../../services/backendApi'
import { ROLES } from '../../utils/constants'
import { isValidEmail, isValidPhone, required, validatePasswordMatch } from '../../utils/validation'
import { Field, inputClass } from './formHelpers'
import AddressLocationField from '../../components/AddressLocationField'
import { isValidLocation } from '../../services/mapServices'

const EMPTY = { name: '', email: '', phone: '', password: '', confirm: '', address: '', city: '', latitude: null, longitude: null, terms: false }

export default function RegisterUser() {
  const { registerAndLogin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (field) => (e) => {
    const value = field === 'terms' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }
  const updateLocation = (patch) => setForm((current) => ({ ...current, ...patch }))

  const validate = () => {
    const next = {}
    if (!required(form.name)) next.name = 'Full name is required.'
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.'
    if (!isValidPhone(form.phone)) next.phone = 'Enter a valid phone number.'
    if (!validatePasswordMatch(form.password, form.confirm, awsApiEnabled)) {
      next.confirm = awsApiEnabled
        ? 'Use at least 8 characters with an uppercase letter, a lowercase letter, and a number. Passwords must match.'
        : 'Passwords must match and be at least 8 characters.'
    }
    if (!required(form.address)) next.address = 'Pickup address is required.'
    if (!required(form.city)) next.city = 'City is required.'
    if (!isValidLocation(form)) next.location = 'Locate your address on the map or use your current location.'
    if (!form.terms) next.terms = 'You must accept the terms to continue.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return
    setSaving(true)
    try {
      const result = await registerAndLogin(ROLES.USER, form)
      if (!result.ok) {
        setFormError(result.error)
        return
      }
      if (result.confirmationRequired) {
        navigate('/confirm-signup', { state: { email: result.email } })
        return
      }
      toast.success('Account created! Welcome to ReVive.')
      navigate('/user/dashboard')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-mint-light px-4 py-12">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm border border-emerald-100">
        <Link to="/register" className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-forest">
          <ArrowLeft size={16} /> Choose a different role
        </Link>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-light text-forest">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-charcoal">Create a resident account</h1>
            <p className="text-sm text-charcoal/60">Start scheduling pickups and earning rewards.</p>
          </div>
        </div>

        {formError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <Field label="Full name" error={errors.name}>
            <input value={form.name} onChange={update('name')} className={inputClass(errors.name)} />
          </Field>
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
          {awsApiEnabled && <p className="-mt-2 text-xs text-charcoal/60">Password must have at least 8 characters, including uppercase and lowercase letters and a number. A symbol is optional.</p>}
          <AddressLocationField address={form.address} city={form.city} location={form} onChange={updateLocation} addressLabel="Pickup address" addressError={errors.address} cityError={errors.city} locationError={errors.location} />

          <label className="flex items-start gap-2 text-sm text-charcoal/70">
            <input type="checkbox" checked={form.terms} onChange={update('terms')} className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-forest" />
            I agree to the ReVive terms of service.
          </label>
          {errors.terms && <p className="text-xs text-red-600">{errors.terms}</p>}

          <button type="submit" disabled={saving} className="w-full rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition disabled:opacity-60">
            {saving ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-3 text-center text-sm text-charcoal/60">
          Already have an account? <Link to="/login" className="font-semibold text-forest hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
