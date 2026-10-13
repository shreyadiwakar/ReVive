import { ArrowLeft, LogIn, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { roleHomePath, useAuth } from '../context/AuthContext'
import { ROLES } from '../utils/constants'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await login(email, password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (result.session.role === ROLES.ADMIN) {
        setError('Administrator accounts must sign in from the admin login page.')
        return
      }
      navigate(roleHomePath(result.session.role))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-mint-light">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-10 px-4 py-12 md:flex-row md:items-stretch">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-emerald-100 self-center">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-forest">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <h1 className="mt-5 text-2xl font-bold text-charcoal">Welcome back</h1>
          <p className="mt-1 text-sm text-charcoal/60">Sign in to your ReVive dashboard</p>
          {location.state?.message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-forest">{location.state.message}</p>}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-charcoal">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-charcoal">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
              <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition"
            >
              <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-charcoal/60">
            New here? <Link to="/register" className="font-semibold text-forest hover:underline">Create an account</Link>
          </p>
          <p className="mt-2 text-center text-xs text-charcoal/40">
            Recycling center or delivery partner staff? Use the same form above.
          </p>
        </div>

      </div>
    </div>
  )
}
