import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  authenticate,
  findUserById,
  registerCenter,
  registerDelivery,
  registerUser,
  subscribe,
} from '../services/dataService'
import { loadSession, saveSession } from '../services/storage'
import { ROLES } from '../utils/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession())
  const [tick, setTick] = useState(0)

  useEffect(() => subscribe(() => setTick((t) => t + 1)), [])

  const user = useMemo(() => {
    void tick
    if (!session?.userId) return null
    return findUserById(session.userId)
  }, [session, tick])

  const login = (email, password, expectedRole) => {
    const result = authenticate(email, password, expectedRole)
    if (!result.ok) return result
    saveSession(result.session)
    setSession(result.session)
    return result
  }

  const logout = () => {
    saveSession(null)
    setSession(null)
  }

  const registerAndLogin = (role, payload) => {
    let result
    if (role === ROLES.USER) result = registerUser(payload)
    else if (role === ROLES.DELIVERY) result = registerDelivery(payload)
    else if (role === ROLES.CENTER) result = registerCenter(payload)
    else return { ok: false, error: 'Unknown role.' }

    if (!result.ok) return result
    const newSession = { userId: result.user.id, email: result.user.email, role: result.user.role, name: result.user.name }
    saveSession(newSession)
    setSession(newSession)
    return result
  }

  const value = useMemo(
    () => ({ session, user, login, logout, registerAndLogin, isAuthenticated: !!session }),
    [session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function roleHomePath(role) {
  const map = {
    [ROLES.USER]: '/user/dashboard',
    [ROLES.DELIVERY]: '/delivery/dashboard',
    [ROLES.CENTER]: '/center/dashboard',
    [ROLES.ADMIN]: '/admin/dashboard',
  }
  return map[role] || '/'
}
