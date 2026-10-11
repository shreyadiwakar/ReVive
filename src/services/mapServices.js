const DEFAULT_CENTER = [20.5937, 78.9629]
const OSRM_BASE = import.meta.env.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org'
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available in this browser.'))
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(error.code === 1 ? 'Allow location access or place the pin on the map.' : 'Could not get your location. Place the pin on the map instead.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  })
}

export function isValidLocation(location) {
  return location?.latitude !== null && location?.latitude !== undefined && location?.latitude !== ''
    && location?.longitude !== null && location?.longitude !== undefined && location?.longitude !== ''
    && Number.isFinite(Number(location.latitude))
    && Number(location.latitude) >= -90 && Number(location.latitude) <= 90
    && Number.isFinite(Number(location?.longitude))
    && Number(location.longitude) >= -180 && Number(location.longitude) <= 180
}

export function isGeocoderConfigured() {
  return Boolean(MAPBOX_TOKEN)
}

async function mapboxRequest(path, params) {
  if (!MAPBOX_TOKEN) throw new Error('Address lookup needs a Mapbox access token. Add VITE_MAPBOX_ACCESS_TOKEN to .env.local, then restart the frontend.')
  const query = new URLSearchParams({ ...params, access_token: MAPBOX_TOKEN, permanent: 'true' })
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/${path}?${query}`)
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403
    ? 'Mapbox rejected the access token. Check its Geocoding API access and URL restrictions.'
    : 'Address lookup is unavailable right now. You can still move the map pin manually.')
  const result = await response.json()
  const feature = result.features?.[0]
  if (!feature) throw new Error('No matching address was found. Try adding the area and city, or pin the map manually.')
  const [longitude, latitude] = feature.geometry?.coordinates ?? []
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('The address result did not include a usable map location.')
  const props = feature.properties ?? {}
  const context = props.context ?? {}
  return {
    latitude,
    longitude,
    address: props.full_address || [props.name, props.place_formatted].filter(Boolean).join(', '),
    city: context.place?.name || context.locality?.name || context.district?.name || context.region?.name || '',
  }
}

export function findAddressOnMap(address, city = '') {
  const query = [address?.trim(), city?.trim()].filter(Boolean).join(', ')
  if (!query) return Promise.reject(new Error('Enter an address first.'))
  return mapboxRequest('forward', { q: query, limit: '1', autocomplete: 'false', language: 'en' })
}

export function findAddressAtLocation(location) {
  if (!isValidLocation(location)) return Promise.reject(new Error('Set a valid map pin first.'))
  return mapboxRequest('reverse', {
    longitude: String(Number(location.longitude)), latitude: String(Number(location.latitude)),
    limit: '1', language: 'en', worldview: 'in',
  })
}

export function haversineKm(from, to) {
  const rad = (degrees) => degrees * Math.PI / 180
  const dLat = rad(to.latitude - from.latitude)
  const dLon = rad(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function coordString(location) {
  return `${Number(location.longitude)},${Number(location.latitude)}`
}

export async function getDrivingDistances(origin, destinations) {
  const usable = destinations.filter((entry) => isValidLocation(entry.location))
  if (!isValidLocation(origin) || usable.length === 0) return new Map()

  try {
    const coordinates = [origin, ...usable.map((entry) => entry.location)].map(coordString).join(';')
    const destinationIndexes = usable.map((_, index) => index + 1).join(';')
    const response = await fetch(`${OSRM_BASE}/table/v1/driving/${coordinates}?sources=0&destinations=${destinationIndexes}&annotations=distance`)
    if (!response.ok) throw new Error('Routing service unavailable.')
    const result = await response.json()
    const distances = result.distances?.[0]
    if (!Array.isArray(distances)) throw new Error('No route distances returned.')

    return new Map(usable.map((entry, index) => {
      const meters = distances[index]
      return [entry.id, Number.isFinite(meters)
        ? { km: meters / 1000, kind: 'road' }
        : { km: haversineKm(origin, entry.location), kind: 'straight' }]
    }))
  } catch {
    return new Map(usable.map((entry) => [entry.id, { km: haversineKm(origin, entry.location), kind: 'straight' }]))
  }
}

// Strict road-routing variant for views where a straight-line fallback would
// be misleading. Missing routes are omitted so callers can show unavailable.
export async function getRoadDistances(origin, destinations) {
  const usable = destinations.filter((entry) => isValidLocation(entry.location))
  if (!isValidLocation(origin) || usable.length === 0) return new Map()

  try {
    const coordinates = [origin, ...usable.map((entry) => entry.location)].map(coordString).join(';')
    const destinationIndexes = usable.map((_, index) => index + 1).join(';')
    const response = await fetch(`${OSRM_BASE}/table/v1/driving/${coordinates}?sources=0&destinations=${destinationIndexes}&annotations=distance`)
    if (!response.ok) return new Map()
    const result = await response.json()
    const distances = result.distances?.[0]
    if (!Array.isArray(distances)) return new Map()
    return new Map(usable.flatMap((entry, index) => Number.isFinite(distances[index])
      ? [[entry.id, { km: distances[index] / 1000, kind: 'road' }]]
      : []))
  } catch {
    return new Map()
  }
}

export async function getDrivingDistance(from, to) {
  const distances = await getDrivingDistances(from, [{ id: 'destination', location: to }])
  return distances.get('destination') ?? null
}

export function mapCenterFor(location) {
  return isValidLocation(location)
    ? [Number(location.latitude), Number(location.longitude)]
    : DEFAULT_CENTER
}

export function formatDistance(distance) {
  if (!distance || !Number.isFinite(distance.km)) return 'Distance unavailable'
  const formatted = distance.km < 10 ? distance.km.toFixed(1) : Math.round(distance.km).toString()
  return `${formatted} km ${distance.kind === 'road' ? 'by road' : 'straight-line estimate'}`
}
