import { LocateFixed, MapPin, Search } from 'lucide-react'
import { useState } from 'react'
import LocationPickerMap from './LocationPickerMap'
import { findAddressAtLocation, findAddressOnMap, getCurrentLocation, isGeocoderConfigured } from '../services/mapServices'

export default function AddressLocationField({
  address,
  city = '',
  location,
  onChange,
  addressLabel = 'Address',
  cityLabel = 'City',
  addressRows = 2,
  addressError,
  cityError,
  locationError,
  height = 240,
}) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const hasGeocoder = isGeocoderConfigured()

  const setMapResult = (result) => onChange({
    latitude: result.latitude,
    longitude: result.longitude,
    ...(result.address ? { address: result.address } : {}),
    ...(result.city ? { city: result.city } : {}),
  })

  const searchAddress = async () => {
    setBusy('search'); setError(''); setNotice('')
    try {
      const result = await findAddressOnMap(address, city)
      setMapResult(result)
      setNotice('Address located. Check the pin and adjust it if needed.')
    } catch (reason) { setError(reason.message) }
    finally { setBusy('') }
  }

  const useDeviceLocation = async () => {
    setBusy('device'); setError(''); setNotice('')
    try {
      const coordinates = await getCurrentLocation()
      const result = await findAddressAtLocation(coordinates)
      setMapResult(result)
      setNotice('Address filled from your device location. Check the pin and address before saving.')
    } catch (reason) { setError(reason.message) }
    finally { setBusy('') }
  }

  const fillFromPin = async () => {
    setBusy('pin'); setError(''); setNotice('')
    try {
      const result = await findAddressAtLocation(location)
      setMapResult({ ...result, latitude: location.latitude, longitude: location.longitude })
      setNotice('Address filled from the selected map pin.')
    } catch (reason) { setError(reason.message) }
    finally { setBusy('') }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal">{addressLabel}</label>
        <textarea rows={addressRows} value={address} onChange={(event) => onChange({ address: event.target.value, latitude: null, longitude: null })} className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 ${addressError ? 'border-red-300' : 'border-emerald-200'}`} />
        {addressError && <p className="mt-1 text-xs text-red-600">{addressError}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal">{cityLabel}</label>
        <input value={city} onChange={(event) => onChange({ city: event.target.value, latitude: null, longitude: null })} className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 ${cityError ? 'border-red-300' : 'border-emerald-200'}`} />
        {cityError && <p className="mt-1 text-xs text-red-600">{cityError}</p>}
      </div>
      <div className="rounded-xl bg-mint-light/70 p-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={searchAddress} disabled={!hasGeocoder || !!busy || !address?.trim()} title={!hasGeocoder ? 'Configure Mapbox to enable address lookup.' : undefined} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-forest disabled:cursor-not-allowed disabled:opacity-50">
            <Search size={14} /> {busy === 'search' ? 'Finding address…' : 'Find address on map'}
          </button>
          <button type="button" onClick={useDeviceLocation} disabled={!hasGeocoder || !!busy} title={!hasGeocoder ? 'Configure Mapbox to enable address autofill.' : undefined} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-forest disabled:cursor-not-allowed disabled:opacity-50">
            <LocateFixed size={14} /> {busy === 'device' ? 'Finding location…' : 'Use my location & fill address'}
          </button>
          <button type="button" onClick={fillFromPin} disabled={!hasGeocoder || !!busy} title={!hasGeocoder ? 'Configure Mapbox to enable address autofill.' : undefined} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-forest disabled:cursor-not-allowed disabled:opacity-50">
            <MapPin size={14} /> {busy === 'pin' ? 'Looking up pin…' : 'Fill address from pin'}
          </button>
        </div>
        <p className="mt-2 text-xs text-charcoal/55">You can also click the map to set the exact point. Address lookup sends the entered address or selected coordinates to Mapbox only when you click a lookup button.</p>
        {!hasGeocoder && <p className="mt-1 text-xs text-amber-800">Address search and autofill need <code>VITE_MAPBOX_ACCESS_TOKEN</code> in the root <code>.env.local</code> file. Manual map pins still work.</p>}
      </div>
      <LocationPickerMap value={location} onChange={(point) => onChange(point)} height={height} />
      {locationError && <p className="text-xs text-red-600">{locationError}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {notice && <p role="status" className="text-xs text-forest">{notice}</p>}
    </div>
  )
}
