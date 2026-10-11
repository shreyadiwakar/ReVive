import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  authenticate,
  findUserById,
  registerCenter,
  registerDelivery,
  subscribe,
} from '../services/dataService'
import { loadSession, saveSession } from '../services/storage'
import { backendEnabled, getBackendAccount, loginBackendUser, registerBackendUser, updateBackendAccount } from '../services/backendApi'
import { ROLES } from '../utils/constants'

const AuthContext = createContext(null)

function restoreSession() {
  const stored = loadSession()
  if (backendEnabled && stored && !stored.backendUser) {
    saveSession(null)
    return null
  }
  return stored
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(restoreSession)
  const [tick, setTick] = useState(0)

  useEffect(() => subscribe(() => setTick((t) => t + 1)), [])

  useEffect(() => {
    if (!backendEnabled || !session?.backendUser) return undefined
    let active = true
    const refreshAccount = async () => {
      try {
        const profile = await getBackendAccount()
        if (!active) return
        const nextSession = { ...session, ...profile, userId: session.userId, backendUser: true }
        saveSession(nextSession)
        setSession(nextSession)
      } catch { /* Keep the current session visible if the local API is temporarily unavailable. */ }
    }
    void refreshAccount()
    const interval = window.setInterval(refreshAccount, 10000)
    window.addEventListener('focus', refreshAccount)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshAccount)
    }
  }, [session?.userId, session?.backendUser])

  const user = useMemo(() => {
    void tick
    if (!session?.userId) return null
    if (session.backendUser) return { ...session, id: session.userId }
    return findUserById(session.userId)
  }, [session, tick])

  const login = async (email, password, expectedRole) => {
    if (backendEnabled) {
      try {
        const result = await loginBackendUser(email, password)
        const nextSession = { ...result.session, userId: result.session.id, backendUser: true }
        if (expectedRole && nextSession.role !== expectedRole) return { ok: false, error: 'This login is not valid for that account type.' }
        saveSession(nextSession)
        setSession(nextSession)
        return { ok: true, session: nextSession }
      } catch (error) {
        return { ok: false, error: error.message || 'Could not sign in.' }
      }
    } else if (expectedRole === ROLES.USER) {
      return { ok: false, error: 'Resident accounts use the local backend. Start it and try again.' }
    }

    const result = authenticate(email, password, expectedRole)
    if (!result.ok) return result
    if (result.session.role === ROLES.USER) {
      return { ok: false, error: 'Resident accounts use the local backend. Start it and try again.' }
    }
    saveSession(result.session)
    setSession(result.session)
    return result
  }

  const logout = () => {
    saveSession(null)
    setSession(null)
  }

  const registerAndLogin = async (role, payload) => {
    if (backendEnabled) {
      if (role === ROLES.ADMIN) return { ok: false, error: 'Administrator accounts are created with the local admin setup command.' }
      try {
        const result = await registerBackendUser({ ...payload, role })
        const nextSession = { ...result.session, userId: result.session.id, backendUser: true }
        saveSession(nextSession)
        setSession(nextSession)
        return { ok: true, user: nextSession }
      } catch (error) {
        return { ok: false, error: error.message || 'Could not create account.' }
      }
    }
    if (role === ROLES.USER) return { ok: false, error: 'Start the local backend before creating a resident account.' }
    let result
    if (role === ROLES.DELIVERY) result = registerDelivery(payload)
    else if (role === ROLES.CENTER) result = registerCenter(payload)
    else return { ok: false, error: 'Unknown role.' }

    if (!result.ok) return result
    const newSession = { userId: result.user.id, email: result.user.email, role: result.user.role, name: result.user.name }
    saveSession(newSession)
    setSession(newSession)
    return result
  }

  const updateProfile = async (patch) => {
    if (session?.backendUser) {
      try {
        const result = await updateBackendAccount(patch)
        const nextSession = { ...session, ...result.profile, userId: session.userId, backendUser: true }
        saveSession(nextSession)
        setSession(nextSession)
        return { ok: true, user: nextSession }
      } catch (error) {
        return { ok: false, error: error.message || 'Could not update profile.' }
      }
    }
    return { ok: false, error: 'This profile is not connected to the backend.' }
  }

  const value = useMemo(
    () => ({ session, user, login, logout, registerAndLogin, updateProfile, isAuthenticated: !!session }),
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
