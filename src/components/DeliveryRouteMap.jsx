import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import { isValidLocation, mapCenterFor } from '../services/mapServices'

const tileUrl = import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function FitRoute({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points.map(mapCenterFor), { padding: [24, 24], maxZoom: 14 })
    else if (points.length === 1) map.setView(mapCenterFor(points[0]), 14)
  }, [map, points])
  return null
}

export default function DeliveryRouteMap({ driver, pickup, center }) {
  const stops = [
    { id: 'driver', location: driver, label: 'Your current location', color: '#2563eb', fill: '#60a5fa' },
    { id: 'pickup', location: pickup, label: 'Pickup location', color: '#b45309', fill: '#fbbf24' },
    { id: 'center', location: center, label: 'Recycling center', color: '#1b5e3a', fill: '#2bc48a' },
  ].filter((stop) => isValidLocation(stop.location))
  const points = stops.map((stop) => stop.location)
  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200">
      <MapContainer center={mapCenterFor(points[0])} zoom={12} scrollWheelZoom className="h-[280px] w-full">
        <TileLayer url={tileUrl} attribution={attribution} />
        <FitRoute points={points} />
        {stops.map((stop, index) => (
          <CircleMarker key={stop.id} center={mapCenterFor(stop.location)} radius={9} pathOptions={{ color: stop.color, fillColor: stop.fill, fillOpacity: 0.95 }}>
            <Popup>{index + 1}. {stop.label}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
