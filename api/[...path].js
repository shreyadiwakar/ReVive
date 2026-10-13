const categories = ['Plastic', 'Paper', 'Glass', 'Metal', 'E-waste', 'Organic', 'Other']
const ratesDefault = { Plastic: 20, Paper: 15, Glass: 18, Metal: 25, 'E-waste': 30, Organic: 10, Other: 12 }

function config() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anonKey) throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel project settings.')
  return { url: url.replace(/\/$/, ''), serviceKey, anonKey }
}

function send(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').send(JSON.stringify(payload))
}

function fail(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

async function request(url, { key, token = key, method = 'GET', body, headers = {} }) {
  const response = await fetch(url, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json', Prefer: 'return=representation' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) throw fail(response.status, data?.message || data?.msg || data?.error_description || data?.error || 'Database request failed.')
  return data
}

function rest(table, params = '') {
  const { url } = config()
  return `${url}/rest/v1/${table}${params ? `?${params}` : ''}`
}

async function db(table, params = '', options = {}) {
  const { serviceKey } = config()
  return request(rest(table, params), { key: serviceKey, ...options })
}

const getRows = (table, query = 'select=*') => db(table, query)
const one = async (table, query) => (await getRows(table, query))[0] || null
const eq = (column, value) => `${column}=eq.${encodeURIComponent(value)}`

function accountView(account, center = null) {
  if (!account) return null
  const profile = account.profile || {}
  return {
    ...profile,
    ...(center ? { ...centerView(center), id: account.id, centerId: center.id } : {}),
    id: account.id,
    email: account.email,
    role: account.role,
    name: account.name,
    phone: account.phone || '',
    address: account.address || '',
    city: account.city || '',
    status: account.status,
    approvalStatus: account.approval_status,
    createdAt: account.created_at,
  }
}

function centerView(center) {
  return {
    id: center.id, centerId: center.id, ownerUserId: center.owner_id,
    name: center.name, contactPerson: center.contact_person, phone: center.phone,
    city: center.city, address: center.address, latitude: center.latitude, longitude: center.longitude,
    acceptedCategories: center.accepted_categories || [], operatingHours: center.operating_hours,
    description: center.description, available: center.available, businessVerified: center.business_verified,
    approvalStatus: center.approval_status, rating: Number(center.rating || 0), createdAt: center.created_at,
  }
}

function pickupView(p, resident, center, partner) {
  return {
    id: p.id,
    residentId: p.resident_id, userId: p.resident_id,
    residentName: resident?.name || 'Resident', userName: resident?.name || 'Resident',
    centerId: p.center_id, centerName: center?.name || 'Recycling center',
    deliveryPartnerId: p.delivery_partner_id,
    deliveryPartnerName: partner?.name || null,
    wasteCategory: p.waste_category, quantityKg: Number(p.quantity_kg),
    verifiedWeightKg: p.verified_weight_kg == null ? null : Number(p.verified_weight_kg),
    pickupAddress: p.pickup_address, pickupLatitude: p.pickup_latitude, pickupLongitude: p.pickup_longitude,
    scheduledAt: p.scheduled_at, instructions: p.instructions, status: p.status,
    pointsAwarded: p.points_awarded, pointsAwardedAt: p.points_awarded_at,
    earningDistanceKm: p.earning_distance_km == null ? null : Number(p.earning_distance_km),
    earningDistanceMethod: p.earning_distance_method,
    earningDistanceCapturedAt: p.earning_distance_captured_at,
    vehicleWeightLimitKg: p.vehicle_weight_limit_kg,
    timeline: p.timeline || [], createdAt: p.created_at, updatedAt: p.updated_at,
  }
}

async function pickupViews(pickups) {
  if (!pickups.length) return []
  const ids = (values) => [...new Set(values.filter(Boolean))]
  const residentsIds = ids(pickups.map((p) => p.resident_id))
  const centerIds = ids(pickups.map((p) => p.center_id))
  const partnerIds = ids(pickups.map((p) => p.delivery_partner_id))
  const inList = (values) => `in.(${values.join(',')})`
  const [residents, centers, partners] = await Promise.all([
    residentsIds.length ? getRows('accounts', `select=id,name&id=${inList(residentsIds)}`) : [],
    centerIds.length ? getRows('centers', `select=id,name&id=${inList(centerIds)}`) : [],
    partnerIds.length ? getRows('accounts', `select=id,name&id=${inList(partnerIds)}`) : [],
  ])
  const byId = (rows) => new Map(rows.map((row) => [row.id, row]))
  const residentsById = byId(residents); const centersById = byId(centers); const partnersById = byId(partners)
  return pickups.map((p) => pickupView(p, residentsById.get(p.resident_id), centersById.get(p.center_id), partnersById.get(p.delivery_partner_id)))
}

async function currentAccount(req) {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) throw fail(401, 'Authentication is required. Sign in again.')
  const { url, anonKey, serviceKey } = config()
  const identity = await request(`${url}/auth/v1/user`, { key: anonKey, token })
  const account = await one('accounts', `select=*&${eq('id', identity.id)}`)
  if (!account) throw fail(401, 'Your profile was not found. Sign in again.')
  if (account.status === 'suspended') throw fail(403, 'This account is suspended.')
  const center = account.role === 'center' ? await one('centers', `select=*&${eq('owner_id', account.id)}`) : null
  return { account, center, token, serviceKey }
}

function needRole(ctx, roles) {
  if (!roles.includes(ctx.account.role)) throw fail(403, 'Your account type cannot perform this action.')
  if (['delivery', 'center'].includes(ctx.account.role) && ctx.account.approval_status !== 'approved') {
    throw fail(403, 'Your account is awaiting administrator approval.')
  }
}

async function authUser(path, body, key) {
  const { url } = config()
  return request(`${url}/auth/v1/${path}`, { key, token: key, method: 'POST', body })
}

async function createAccount(input) {
  const { url, anonKey, serviceKey } = config()
  const role = input.role || 'user'
  if (!['user', 'delivery', 'center'].includes(role)) throw fail(400, 'This account role cannot self-register.')
  const email = String(input.email || '').trim().toLowerCase()
  const password = input.password
  const name = String(role === 'center' ? input.centerName : input.name || '').trim()
  if (!email.includes('@') || typeof password !== 'string' || password.length < 8 || !name) throw fail(400, 'Enter a valid email, a name, and a password with at least 8 characters.')
  if (!input.address?.trim() || !input.city?.trim()) throw fail(400, 'A street address and city are required.')
  if (!Number.isFinite(Number(input.latitude)) || !Number.isFinite(Number(input.longitude))) throw fail(400, 'Locate the address on the map before creating an account.')
  if (role === 'center' && (!input.contactPerson?.trim() || !input.acceptedCategories?.length)) throw fail(400, 'Center contact and accepted categories are required.')
  if (role === 'delivery' && (!input.serviceArea?.trim() || !input.vehicleType?.trim() || !input.vehicleReg?.trim())) throw fail(400, 'Delivery service area and vehicle details are required.')

  const created = await request(`${url}/auth/v1/admin/users`, {
    key: serviceKey, token: serviceKey, method: 'POST',
    body: { email, password, email_confirm: true, user_metadata: { name } },
  })
  const id = created.id
  const approval = role === 'user' ? 'approved' : 'pending'
  const profile = role === 'delivery'
    ? { serviceArea: input.serviceArea.trim(), vehicleType: input.vehicleType.trim(), vehicleReg: input.vehicleReg.trim(), identityVerified: false, latitude: Number(input.latitude), longitude: Number(input.longitude) }
    : role === 'center' ? { latitude: Number(input.latitude), longitude: Number(input.longitude) } : { latitude: Number(input.latitude), longitude: Number(input.longitude) }
  try {
    await db('accounts', '', { method: 'POST', body: {
      id, email, role, name, phone: input.phone?.trim() || '', address: input.address.trim(), city: input.city.trim(),
      status: 'active', approval_status: approval, profile,
    } })
    if (role === 'center') {
      await db('centers', '', { method: 'POST', body: {
        owner_id: id, name, contact_person: input.contactPerson.trim(), phone: input.phone?.trim() || '',
        city: input.city.trim(), address: input.address.trim(), latitude: Number(input.latitude), longitude: Number(input.longitude),
        accepted_categories: input.acceptedCategories, operating_hours: input.operatingHours?.trim() || '',
        description: input.description?.trim() || '', available: false, business_verified: false, approval_status: 'pending',
      } })
    }
  } catch (error) {
    await request(`${url}/auth/v1/admin/users/${id}`, { key: serviceKey, token: serviceKey, method: 'DELETE' }).catch(() => {})
    throw error
  }
  const signedIn = await authUser('token?grant_type=password', { email, password }, anonKey)
  const account = await one('accounts', `select=*&${eq('id', id)}`)
  const center = role === 'center' ? await one('centers', `select=*&${eq('owner_id', id)}`) : null
  return { status: 'confirmed', session: { ...accountView(account, center), accessToken: signedIn.access_token, refreshToken: signedIn.refresh_token, expiresAt: signedIn.expires_at, backendUser: true } }
}

async function signIn(input) {
  const { anonKey } = config()
  if (!input.email || !input.password) throw fail(400, 'Email and password are required.')
  const signedIn = await authUser('token?grant_type=password', { email: input.email.trim().toLowerCase(), password: input.password }, anonKey)
  const account = await one('accounts', `select=*&${eq('id', signedIn.user.id)}`)
  if (!account) throw fail(403, 'This account is not configured in ReVive.')
  if (account.status === 'suspended') throw fail(403, 'This account is suspended.')
  const center = account.role === 'center' ? await one('centers', `select=*&${eq('owner_id', account.id)}`) : null
  return { session: { ...accountView(account, center), accessToken: signedIn.access_token, refreshToken: signedIn.refresh_token, expiresAt: signedIn.expires_at, backendUser: true } }
}

async function centersList() {
  const rows = await getRows('centers', 'select=*&approval_status=eq.approved&available=eq.true&order=name.asc')
  return { items: rows.map(centerView) }
}

async function listComplaints(ctx) {
  if (ctx.account.role === 'admin') {
    const complaints = await getRows('complaints', 'select=*&order=created_at.desc')
    const ids = [...new Set(complaints.map((c) => c.account_id))]
    const users = ids.length ? await getRows('accounts', `select=id,name,email,role&id=in.(${ids.join(',')})`) : []
    const byId = new Map(users.map((u) => [u.id, u]))
    return complaints.map((c) => ({ id: c.id, userId: c.account_id, user: byId.get(c.account_id)?.name || 'Resident', accountName: byId.get(c.account_id)?.name || 'Resident', accountType: byId.get(c.account_id)?.role || '', pickupId: c.pickup_id, subject: c.subject, details: c.details, status: c.status, resolvedAt: c.resolved_at, createdAt: c.created_at }))
  }
  const rows = await getRows('complaints', `select=*&${eq('account_id', ctx.account.id)}&order=created_at.desc`)
  return rows.map((r) => ({ id: r.id, userId: r.account_id, subject: r.subject, details: r.details, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at, pickupId: r.pickup_id }))
}

async function snapshot() {
  const [accounts, centers, pickups, transactions, complaints, coupons, rates] = await Promise.all([
    getRows('accounts', 'select=*&order=created_at.desc'), getRows('centers'),
    getRows('pickups', 'select=*&order=created_at.desc'), getRows('reward_transactions', 'select=*&order=created_at.desc'),
    getRows('complaints', 'select=*&order=created_at.desc'), getRows('coupons', 'select=*&order=created_at.desc'),
    getRows('points_rates'),
  ])
  const centerByOwner = new Map(centers.map((c) => [c.owner_id, centerView(c)]))
  const txUserIds = [...new Set(transactions.map((t) => t.resident_id))]
  const txUsers = txUserIds.length ? await getRows('accounts', `select=id,name&id=in.(${txUserIds.join(',')})`) : []
  const names = new Map(txUsers.map((u) => [u.id, u.name]))
  const defaultRates = { ...ratesDefault }
  rates.forEach((r) => { defaultRates[r.category] = Number(r.points_per_kg) })
  return {
    users: accounts.map((a) => accountView(a, centerByOwner.get(a.id))), centers: centers.map(centerView),
    pickups: await pickupViews(pickups), rewardTransactions: transactions.map((t) => ({ id: t.id, userId: t.resident_id, userName: names.get(t.resident_id) || 'Resident', amount: t.amount, description: t.description, createdAt: t.created_at, pickupId: t.pickup_id, couponId: t.coupon_id, type: t.type })),
    complaints: complaints.map((c) => {
      const sender = accounts.find((a) => a.id === c.account_id)
      return { id: c.id, userId: c.account_id, user: sender?.name || 'Resident', accountName: sender?.name || 'Resident', accountRole: sender?.role || 'user', pickupId: c.pickup_id, subject: c.subject, details: c.details, status: c.status, resolvedAt: c.resolved_at, createdAt: c.created_at }
    }),
    coupons: coupons.map(couponView), config: { pointsPerKg: defaultRates },
  }
}

function couponView(c) {
  return { id: c.id, title: c.title, partner: c.partner, pointsCost: Number(c.points_cost), category: c.category, active: c.active, createdAt: c.created_at }
}

async function main(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  const path = new URL(req.url, 'https://revive.invalid').pathname.replace(/^\/api/, '') || '/'
  const method = req.method
  const body = req.body && typeof req.body === 'object' ? req.body : {}

  if (method === 'POST' && path === '/auth/signup') return send(res, 201, await createAccount(body))
  if (method === 'POST' && path === '/auth/login') return send(res, 200, await signIn(body))
  if (method === 'GET' && path === '/centers') return send(res, 200, await centersList())
  if (method === 'GET' && path === '/coupons') {
    const rows = await getRows('coupons', 'select=*&active=eq.true&order=created_at.desc')
    return send(res, 200, { items: rows.map(couponView) })
  }

  const ctx = await currentAccount(req)
  if (method === 'GET' && path === '/account') return send(res, 200, { profile: accountView(ctx.account, ctx.center) })
  if (method === 'PATCH' && path === '/account') {
    if (!body.name?.trim()) throw fail(400, 'A name is required.')
    const patch = { name: body.name.trim(), phone: body.phone?.trim() || '', address: body.address?.trim() || '', city: body.city?.trim() || '', updated_at: new Date().toISOString() }
    const updated = await db('accounts', `id=eq.${ctx.account.id}`, { method: 'PATCH', body: patch })
    if (ctx.account.role === 'center' && ctx.center) await db('centers', `id=eq.${ctx.center.id}`, { method: 'PATCH', body: { name: patch.name, phone: patch.phone, address: patch.address, city: patch.city, contact_person: body.contactPerson ?? ctx.center.contact_person, accepted_categories: body.acceptedCategories ?? ctx.center.accepted_categories, operating_hours: body.operatingHours ?? ctx.center.operating_hours, description: body.description ?? ctx.center.description, latitude: body.latitude ?? ctx.center.latitude, longitude: body.longitude ?? ctx.center.longitude } })
    return send(res, 200, { profile: accountView(updated[0], ctx.center) })
  }

  if (path.startsWith('/admin/')) needRole(ctx, ['admin'])
  if (method === 'GET' && path === '/admin/snapshot') return send(res, 200, await snapshot())
  if (method === 'GET' && path === '/complaints') return send(res, 200, { items: await listComplaints(ctx) })
  if (method === 'POST' && path === '/complaints') {
    if (!body.subject?.trim()) throw fail(400, 'Enter a complaint subject.')
    const rows = await db('complaints', '', { method: 'POST', body: { account_id: ctx.account.id, pickup_id: body.pickupId || null, subject: body.subject.trim(), details: body.details?.trim() || '', status: 'open' } })
    const c = rows[0]
    return send(res, 201, { complaint: { id: c.id, subject: c.subject, details: c.details, status: c.status, createdAt: c.created_at } })
  }
  const complaintId = path.match(/^\/complaints\/([^/]+)$/)?.[1]
  if (method === 'DELETE' && complaintId) {
    const removed = await db('complaints', `id=eq.${encodeURIComponent(complaintId)}&account_id=eq.${ctx.account.id}&status=eq.open`, { method: 'DELETE' })
    if (!removed.length) throw fail(404, 'Open complaint not found.')
    return send(res, 200, { deleted: true })
  }
  const adminComplaintId = path.match(/^\/admin\/complaints\/([^/]+)$/)?.[1]
  if (method === 'PATCH' && adminComplaintId) {
    if (!['open', 'resolved'].includes(body.status)) throw fail(400, 'Invalid complaint status.')
    const rows = await db('complaints', `id=eq.${encodeURIComponent(adminComplaintId)}`, { method: 'PATCH', body: { status: body.status, resolved_by: body.status === 'resolved' ? ctx.account.id : null, resolved_at: body.status === 'resolved' ? new Date().toISOString() : null } })
    if (!rows.length) throw fail(404, 'Complaint not found.')
    return send(res, 200, { complaint: rows[0] })
  }

  if (method === 'GET' && path === '/rewards') {
    const rows = await getRows('reward_transactions', `select=*&resident_id=eq.${ctx.account.id}&order=created_at.desc`)
    return send(res, 200, { balance: rows.reduce((sum, t) => sum + Number(t.amount), 0), transactions: rows.map((t) => ({ id: t.id, residentId: t.resident_id, amount: t.amount, description: t.description, createdAt: t.created_at })) })
  }
  if (method === 'POST' && path === '/rewards/redeem') {
    needRole(ctx, ['user'])
    const result = await db('rpc/revive_redeem', '', { method: 'POST', body: { p_resident_id: ctx.account.id, p_coupon_id: body.couponId } })
    return send(res, 200, { transaction: result.transaction, balance: result.balance })
  }

  if (method === 'PATCH' && path === '/admin/config/points') {
    const entries = Object.entries(body.pointsPerKg || {})
    for (const [category, points] of entries) {
      if (!categories.includes(category) || !Number.isFinite(Number(points)) || Number(points) < 0) throw fail(400, 'Invalid points configuration.')
      await db('points_rates', `on_conflict=category`, { method: 'POST', body: { category, points_per_kg: Number(points) }, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } })
    }
    return send(res, 200, { pointsPerKg: body.pointsPerKg })
  }
  if (method === 'POST' && path === '/admin/coupons') {
    if (!body.title?.trim() || !body.partner?.trim() || Number(body.pointsCost) <= 0) throw fail(400, 'Title, partner, and a positive points cost are required.')
    const rows = await db('coupons', '', { method: 'POST', body: { title: body.title.trim(), partner: body.partner.trim(), points_cost: Number(body.pointsCost), category: body.category || 'Other', active: true } })
    return send(res, 201, { coupon: couponView(rows[0]) })
  }
  const adminCouponId = path.match(/^\/admin\/coupons\/([^/]+)$/)?.[1]
  if (method === 'PATCH' && adminCouponId) {
    const patch = {}
    if (body.title !== undefined) patch.title = body.title.trim()
    if (body.partner !== undefined) patch.partner = body.partner.trim()
    if (body.pointsCost !== undefined) patch.points_cost = Number(body.pointsCost)
    if (body.category !== undefined) patch.category = body.category
    if (body.active !== undefined) patch.active = Boolean(body.active)
    if (!Object.keys(patch).length || (patch.points_cost !== undefined && patch.points_cost <= 0)) throw fail(400, 'Coupon id and at least one valid field are required.')
    const rows = await db('coupons', `id=eq.${encodeURIComponent(adminCouponId)}`, { method: 'PATCH', body: patch })
    if (!rows.length) throw fail(404, 'Coupon not found.')
    return send(res, 200, { coupon: couponView(rows[0]) })
  }
  const accountId = path.match(/^\/admin\/accounts\/([^/]+)$/)?.[1]
  if (method === 'PATCH' && accountId) {
    const account = await one('accounts', `select=*&id=eq.${encodeURIComponent(accountId)}`)
    if (!account) throw fail(404, 'Account not found.')
    const patch = {}
    if (body.status) patch.status = body.status
    if (body.approvalStatus) patch.approval_status = body.approvalStatus
    if (!Object.keys(patch).length) throw fail(400, 'No account fields to update.')
    const updated = await db('accounts', `id=eq.${encodeURIComponent(accountId)}`, { method: 'PATCH', body: patch })
    if (body.approvalStatus && account.role === 'center') {
      const center = await one('centers', `select=id&id=eq.${encodeURIComponent(accountId)}`)
      const owned = center || await one('centers', `select=id&owner_id=eq.${encodeURIComponent(accountId)}`)
      if (owned) await db('centers', `id=eq.${owned.id}`, { method: 'PATCH', body: { approval_status: body.approvalStatus, available: body.approvalStatus === 'approved' } })
    }
    return send(res, 200, { profile: accountView(updated[0]) })
  }

  if (method === 'GET' && path === '/center/pickups') {
    needRole(ctx, ['center'])
    const rows = await getRows('pickups', `select=*&center_id=eq.${ctx.center.id}&order=scheduled_at.asc`)
    return send(res, 200, { items: await pickupViews(rows) })
  }
  if (method === 'GET' && path === '/pickups/available') {
    needRole(ctx, ['delivery'])
    const rows = await getRows('pickups', 'select=*&status=eq.Requested&delivery_partner_id=is.null&order=scheduled_at.asc')
    return send(res, 200, { items: await pickupViews(rows) })
  }
  if (method === 'GET' && path === '/pickups/mine') {
    needRole(ctx, ['delivery'])
    const rows = await getRows('pickups', `select=*&delivery_partner_id=eq.${ctx.account.id}&order=scheduled_at.desc`)
    return send(res, 200, { items: await pickupViews(rows) })
  }
  if (method === 'GET' && path === '/pickups') {
    needRole(ctx, ['user'])
    const rows = await getRows('pickups', `select=*&resident_id=eq.${ctx.account.id}&order=created_at.desc`)
    return send(res, 200, { items: await pickupViews(rows) })
  }
  if (method === 'POST' && path === '/pickups') {
    needRole(ctx, ['user'])
    const center = await one('centers', `select=*&id=eq.${encodeURIComponent(body.centerId)}&available=eq.true&approval_status=eq.approved`)
    if (!center || !center.accepted_categories.includes(body.wasteCategory)) throw fail(400, 'Choose an available center that accepts this material.')
    const quantity = Number(body.quantityKg)
    const scheduled = new Date(body.scheduledAt)
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 || Number.isNaN(scheduled.valueOf()) || scheduled <= new Date()) throw fail(400, 'Enter a valid quantity and future pickup time.')
    if (!categories.includes(body.wasteCategory)) throw fail(400, 'Choose a valid waste category.')
    const now = new Date().toISOString()
    const rows = await db('pickups', '', { method: 'POST', body: {
      resident_id: ctx.account.id, center_id: center.id, waste_category: body.wasteCategory, quantity_kg: quantity,
      pickup_address: body.pickupAddress, pickup_latitude: body.pickupLatitude ?? null, pickup_longitude: body.pickupLongitude ?? null,
      scheduled_at: scheduled.toISOString(), instructions: body.instructions || '', status: 'Requested',
      timeline: [{ status: 'Requested', at: now, note: 'Pickup requested' }],
    } })
    return send(res, 201, { pickup: (await pickupViews(rows))[0] })
  }
  const pickupMatch = path.match(/^\/pickups\/([^/]+)(?:\/(cancel|accept|status|verify))?$/)
  if (pickupMatch) {
    const [, id, action] = pickupMatch
    if (method === 'GET' && !action) {
      const row = await one('pickups', `select=*&id=eq.${encodeURIComponent(id)}`)
      if (!row) throw fail(404, 'Pickup not found.')
      const allowed = ctx.account.role === 'admin' || row.resident_id === ctx.account.id || row.delivery_partner_id === ctx.account.id || (ctx.center && ctx.center.id === row.center_id)
      if (!allowed) throw fail(403, 'You cannot view this pickup.')
      return send(res, 200, { pickup: (await pickupViews([row]))[0] })
    }
    if (method === 'POST' && action === 'cancel') {
      needRole(ctx, ['user'])
      const row = await one('pickups', `select=*&id=eq.${encodeURIComponent(id)}&resident_id=eq.${ctx.account.id}`)
      if (!row) throw fail(404, 'Pickup not found.')
      if (!['Requested', 'Accepted', 'Pickup Scheduled'].includes(row.status)) throw fail(409, 'This pickup can no longer be cancelled.')
      const now = new Date().toISOString()
      await db('pickups', `id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'Cancelled', updated_at: now, timeline: [...(row.timeline || []), { status: 'Cancelled', at: now, note: 'Cancelled by resident' }] } })
      return send(res, 200, { status: 'Cancelled' })
    }
    if (method === 'POST' && action === 'accept') {
      needRole(ctx, ['delivery'])
      const row = await db('rpc/revive_claim_pickup', '', { method: 'POST', body: { p_pickup_id: id, p_partner_id: ctx.account.id } })
      return send(res, 200, { pickup: (await pickupViews([row]))[0] })
    }
    if (method === 'PATCH' && action === 'status') {
      needRole(ctx, ['delivery'])
      const row = await db('rpc/revive_set_pickup_status', '', { method: 'POST', body: { p_pickup_id: id, p_partner_id: ctx.account.id, p_status: body.status } })
      return send(res, 200, { pickup: (await pickupViews([row]))[0] })
    }
    if (method === 'POST' && action === 'verify') {
      needRole(ctx, ['center'])
      const result = await db('rpc/revive_verify_pickup', '', { method: 'POST', body: { p_pickup_id: id, p_center_owner: ctx.account.id, p_weight: Number(body.verifiedWeightKg), p_note: body.note || '' } })
      const [pickup] = await pickupViews([result.pickup])
      return send(res, 200, { pickup, reward: result.reward })
    }
  }
  throw fail(404, 'Not found.')
}

export default async function handler(req, res) {
  try {
    await main(req, res)
  } catch (error) {
    console.error('ReVive API error:', error)
    send(res, error.status || 500, { error: error.status ? error.message : 'The API could not complete that request. Check Vercel environment variables and the Supabase schema.' })
  }
}
