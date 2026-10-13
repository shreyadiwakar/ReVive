import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { confirmBackendPasswordReset, requestBackendPasswordReset } from '../services/backendApi'
import { validatePasswordMatch } from '../utils/validation'

export default function ForgotPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const loginPath = location.state?.loginPath === '/admin/login' ? '/admin/login' : '/login'
  const [email, setEmail] = useState(location.state?.email || '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sendCode = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await requestBackendPasswordReset(email)
      setCodeSent(true)
      setMessage(result.message || 'If an account exists for that email, a reset code has been sent.')
    } catch (requestError) {
      setError(requestError.message || 'Could not request a password reset.')
    } finally {
      setBusy(false)
    }
  }

  const handleRequest = async (event) => {
    event.preventDefault()
    await sendCode()
  }

  const handleReset = async (event) => {
    event.preventDefault()
    setError('')
    if (!validatePasswordMatch(password, confirmPassword, true)) {
      setError('Use at least 8 characters with an uppercase letter, a lowercase letter, and a number. Passwords must match.')
      return
    }
    setBusy(true)
    try {
      await confirmBackendPasswordReset(email, code, password)
      navigate(loginPath, { replace: true, state: { message: 'Password updated. Sign in with your new password.' } })
    } catch (requestError) {
      setError(requestError.message || 'Could not reset your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-mint-light px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
        <Link to={loginPath} className="text-sm font-medium text-forest">Back to sign in</Link>
        <h1 className="mt-5 text-2xl font-bold text-charcoal">Reset your password</h1>
        <p className="mt-1 text-sm text-charcoal/60">We’ll email you a code to choose a new password.</p>
        {message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-forest">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p>}

        {!codeSent ? (
          <form onSubmit={handleRequest} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-charcoal">Email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm" />
            </label>
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-charcoal">Email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm" />
            </label>
            <label className="block text-sm font-medium text-charcoal">Reset code
              <input required autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm" />
            </label>
            <label className="block text-sm font-medium text-charcoal">New password
              <input type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm" />
            </label>
            <label className="block text-sm font-medium text-charcoal">Confirm new password
              <input type="password" required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm" />
            </label>
            <p className="text-xs text-charcoal/60">Use at least 8 characters, including uppercase and lowercase letters and a number. A symbol is optional.</p>
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Updating…' : 'Update password'}
            </button>
            <button type="button" onClick={sendCode} disabled={busy} className="w-full text-sm font-semibold text-forest hover:underline disabled:opacity-60">
              Send a new code
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
