import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ConfirmSignup() {
  const { confirmRegistration } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(location.state?.email || '')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await confirmRegistration(email, code)
      navigate('/login', { replace: true, state: { message: 'Email confirmed. Sign in to continue.' } })
    } catch (requestError) {
      setError(requestError.message || 'Could not confirm this email.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-mint-light px-4 py-12">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
        <Link to="/login" className="text-sm font-medium text-forest">Back to sign in</Link>
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Confirm your email</h1>
          <p className="mt-1 text-sm text-charcoal/60">Enter the confirmation code sent to your email.</p>
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p>}
        <label className="block text-sm font-medium text-charcoal">Email
          <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-emerald-200 px-3.5 py-2.5" />
        </label>
        <label className="block text-sm font-medium text-charcoal">Confirmation code
          <input required autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 w-full rounded-xl border border-emerald-200 px-3.5 py-2.5" />
        </label>
        <button disabled={busy} className="w-full rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Confirming…' : 'Confirm email'}
        </button>
      </form>
    </main>
  )
}
