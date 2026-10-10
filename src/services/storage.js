import { STORAGE_KEYS } from '../utils/constants'

export function loadDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DB)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveDatabase(db) {
  localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(db))
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  if (session) localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session))
  else localStorage.removeItem(STORAGE_KEYS.SESSION)
}

export function clearAllReviveData() {
  localStorage.removeItem(STORAGE_KEYS.DB)
  localStorage.removeItem(STORAGE_KEYS.SESSION)
}
