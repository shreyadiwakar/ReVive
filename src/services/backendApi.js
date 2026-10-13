import { loadSession, saveSession } from './storage'

const apiBase = import.meta.env.VITE_API_BASE_URL || ''
const apiMode = import.meta.env.VITE_API_MODE || ''
export const backendEnabled = ['local', 'vercel'].includes(apiMode) && !!apiBase

function headers() {
  const session = loadSession()
  if (apiMode === 'vercel') {
    return session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}
  }
  const role = ['delivery', 'center', 'admin'].includes(session?.role) ? session.role : 'resident'
  const result = { 'x-local-role': role }
  if (session?.userId) result['x-local-user'] = session.userId
  return result
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const requestUrl = `${apiBase.replace(/\/$/, '')}${path}`
  const requestOptions = {
    method,
    headers: { ...headers(), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }
  let response = await fetch(requestUrl, requestOptions)
  if (response.status === 401 && apiMode === 'vercel') {
    const session = loadSession()
    if (session?.refreshToken) {
      const refreshed = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      })
      if (refreshed.ok) {
        const tokens = await refreshed.json()
        const nextSession = { ...session, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: tokens.expires_at }
        saveSession(nextSession)
        requestOptions.headers = { ...requestOptions.headers, authorization: `Bearer ${tokens.access_token}` }
        response = await fetch(requestUrl, requestOptions)
      }
    }
  }
  let data = {}
  try { data = await response.json() } catch { /* response can be empty */ }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`)
    error.status = response.status
    throw error
  }
  return data
}

export function normalizePickup(pickup, session = loadSession()) {
  if (!pickup) return pickup
  return {
    ...pickup,
    userId: pickup.residentId ?? pickup.userId,
    userName: pickup.residentName ?? (pickup.residentId === session?.userId ? session?.name : null) ?? 'Resident',
    deliveryPartnerId: pickup.deliveryPartnerId ? (session?.role === 'delivery' ? session.userId : pickup.deliveryPartnerId) : null,
    deliveryPartnerName: pickup.deliveryPartnerId ? (session?.role === 'delivery' ? session.name : 'Assigned delivery partner') : null,
    timeline: pickup.timeline || [],
  }
}

export async function loadBackendSnapshot(currentDb, session) {
  const centersData = await apiRequest('/centers')
  const centers = centersData.items || []
  if (!session?.userId) return { ...currentDb, centers }
  // Keep the rest of the dashboard usable if it is talking to an older local
  // API process that does not yet expose the coupon catalog route.
  let coupons = []
  try {
    coupons = (await apiRequest('/coupons')).items || []
  } catch (error) {
    if (error.status !== 404) throw error
  }

  if (session.role === 'admin') {
    const data = await apiRequest('/admin/snapshot')
    return {
      ...currentDb,
      centers,
      users: data.users || [],
      pickups: (data.pickups || []).map((item) => normalizePickup(item, session)),
      rewardTransactions: data.rewardTransactions || [],
      complaints: data.complaints || [],
      coupons: data.coupons || coupons,
      config: data.config || currentDb.config,
    }
  }

  if (session.role === 'user') {
    const [pickupsData, rewardsData, complaintsData] = await Promise.all([apiRequest('/pickups'), apiRequest('/rewards'), apiRequest('/complaints')])
    return {
      ...currentDb,
      centers,
      coupons,
      pickups: (pickupsData.items || []).map((item) => normalizePickup(item, session)),
      rewardsBalance: Number(rewardsData.balance || 0),
      rewardTransactions: (rewardsData.transactions || []).map((item) => ({
        ...item, userId: item.residentId, createdAt: item.createdAt,
      })),
      complaints: complaintsData.items || [],
    }
  }
  if (session.role === 'delivery') {
    const [available, mine, complaintsData] = await Promise.all([apiRequest('/pickups/available'), apiRequest('/pickups/mine'), apiRequest('/complaints')])
    const pickups = [...(mine.items || []), ...(available.items || [])]
    return { ...currentDb, centers, coupons, complaints: complaintsData.items || [], pickups: [...new Map(pickups.map((p) => [p.id, normalizePickup(p, session)])).values()] }
  }
  if (session.role === 'center') {
    const [data, complaintsData] = await Promise.all([apiRequest('/center/pickups'), apiRequest('/complaints')])
    return { ...currentDb, centers, coupons, complaints: complaintsData.items || [], pickups: (data.items || []).map((item) => normalizePickup(item, session)) }
  }
  return { ...currentDb, centers }
}

export const createBackendPickup = async (payload) => normalizePickup((await apiRequest('/pickups', { method: 'POST', body: payload })).pickup)
export const getBackendPickup = async (id) => normalizePickup((await apiRequest(`/pickups/${encodeURIComponent(id)}`)).pickup)
export const cancelBackendPickup = (id) => apiRequest(`/pickups/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
export const acceptBackendPickup = (id) => apiRequest(`/pickups/${encodeURIComponent(id)}/accept`, { method: 'POST' })
export const updateBackendPickup = (id, status) => apiRequest(`/pickups/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } })
export const verifyBackendPickup = (id, verifiedWeightKg, note) => apiRequest(`/pickups/${encodeURIComponent(id)}/verify`, { method: 'POST', body: { verifiedWeightKg: Number(verifiedWeightKg), note } })
export const registerBackendUser = (profile) => apiRequest('/auth/signup', { method: 'POST', body: profile })
export const loginBackendUser = (email, password) => apiRequest('/auth/login', { method: 'POST', body: { email, password } })
export const getBackendAccount = async () => (await apiRequest('/account')).profile
export const updateBackendAccount = (profile) => apiRequest('/account', { method: 'PATCH', body: profile })
export const updateBackendAdminAccount = (id, patch) => apiRequest(`/admin/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
export const createBackendCoupon = (payload) => apiRequest('/admin/coupons', { method: 'POST', body: payload })
export const updateBackendCoupon = (id, patch) => apiRequest(`/admin/coupons/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
export const createBackendComplaint = (payload) => apiRequest('/complaints', { method: 'POST', body: payload })
export const updateBackendComplaint = (id, status) => apiRequest(`/admin/complaints/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } })
export const deleteBackendComplaint = (id) => apiRequest(`/complaints/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const updateBackendPointsConfig = (pointsPerKg) => apiRequest('/admin/config/points', { method: 'PATCH', body: { pointsPerKg } })
export const redeemBackendCoupon = (couponId, requestId = crypto.randomUUID()) => apiRequest('/rewards/redeem', {
  method: 'POST', body: { couponId, requestId },
})
