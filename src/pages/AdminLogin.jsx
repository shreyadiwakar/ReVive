import { ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { awsApiEnabled } from '../services/backendApi'
import { ROLES } from '../utils/constants'

export default function AdminLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(email, password, ROLES.ADMIN)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/admin/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-forest-dark px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-forest">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-charcoal">Administrator Login</h1>
            <p className="text-sm text-charcoal/60">Sign in to manage the ReVive platform</p>
          </div>
        </div>

        {location.state?.message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-forest">{location.state.message}</p>}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-charcoal">Admin email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-charcoal">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>
          {awsApiEnabled && <div className="-mt-2 text-right"><Link to="/forgot-password" state={{ email, loginPath: '/admin/login' }} className="text-sm font-semibold text-forest hover:underline">Forgot password?</Link></div>}
          <button
            type="submit"
            className="w-full rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition"
          >
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-xs font-medium text-charcoal/40">
          Authorized personnel only
        </p>

      </div>
    </div>
  )
}
