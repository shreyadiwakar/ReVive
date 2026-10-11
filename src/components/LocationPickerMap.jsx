import { useMap, useMapEvents, MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useEffect } from 'react'
import { isValidLocation, mapCenterFor } from '../services/mapServices'

const tileUrl = import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function MapClick({ onChange }) {
  useMapEvents({
    click(event) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })
  return null
}

function Recenter({ location }) {
  const map = useMap()
  useEffect(() => {
    if (isValidLocation(location)) map.setView(mapCenterFor(location), Math.max(map.getZoom(), 14))
  }, [location?.latitude, location?.longitude, map])
  return null
}

export default function LocationPickerMap({ value, onChange, height = 250 }) {
  const valid = isValidLocation(value)
  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200" style={{ height }}>
      <MapContainer center={mapCenterFor(value)} zoom={valid ? 14 : 4} scrollWheelZoom className="h-full w-full">
        <TileLayer url={tileUrl} attribution={attribution} />
        <MapClick onChange={onChange} />
        <Recenter location={value} />
        {valid && (
          <CircleMarker center={mapCenterFor(value)} radius={10} pathOptions={{ color: '#1b5e3a', fillColor: '#2bc48a', fillOpacity: 0.9 }}>
            <Popup>Selected location</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  )
}
