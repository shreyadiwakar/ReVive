import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getDb, subscribe } from '../services/dataService'

const AppDataContext = createContext(null)

export function AppDataProvider({ children }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    return subscribe(() => setTick((t) => t + 1))
  }, [])

  const db = useMemo(() => {
    void tick
    return getDb()
  }, [tick])

  const refresh = () => setTick((t) => t + 1)

  return (
    <AppDataContext.Provider value={{ db, refresh }}>{children}</AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
