import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getDb, subscribe } from '../services/dataService'
import { useAuth } from './AuthContext'
import { backendEnabled, loadBackendSnapshot } from '../services/backendApi'

const AppDataContext = createContext(null)

function emptyBackendState() {
  return {
    users: [], centers: [], pickups: [], rewardTransactions: [], rewardsBalance: 0,
    coupons: [], complaints: [],
    config: { pointsPerKg: { Plastic: 20, Paper: 15, Glass: 18, Metal: 25, 'E-waste': 30, Organic: 10, Other: 12 } },
  }
}

export function AppDataProvider({ children }) {
  const [tick, setTick] = useState(0)
  const { session } = useAuth()
  const [db, setDb] = useState(() => backendEnabled ? emptyBackendState() : getDb())
  const [loading, setLoading] = useState(backendEnabled)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribe(() => setTick((t) => t + 1))
  }, [])

  useEffect(() => {
    let active = true
    if (!backendEnabled) { setDb(getDb()); setLoading(false); setError(''); return undefined }
    setLoading(true)
    loadBackendSnapshot(emptyBackendState(), session)
      .then((snapshot) => { if (active) { setDb(snapshot); setError('') } })
      .catch((reason) => { if (active) setError(reason.message || 'Could not load backend data.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tick, session])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  return (
    <AppDataContext.Provider value={{ db, refresh, loading, error, backendEnabled }}>{children}</AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
