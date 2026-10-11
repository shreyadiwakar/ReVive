import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import { isValidLocation, mapCenterFor } from '../services/mapServices'

const tileUrl = import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function FitLocations({ locations }) {
  const map = useMap()
  useEffect(() => {
    if (locations.length > 1) map.fitBounds(locations.map(mapCenterFor), { padding: [24, 24], maxZoom: 13 })
    else if (locations.length === 1) map.setView(mapCenterFor(locations[0]), 13)
  }, [locations, map])
  return null
}

export default function CenterMap({ centers, userLocation, selectedCenterId, onSelect }) {
  const mappedCenters = centers.filter((center) => isValidLocation(center))
  const locations = [...(isValidLocation(userLocation) ? [userLocation] : []), ...mappedCenters]
  const mapPoints = locations.length ? locations : [userLocation]
  const initialCenter = mapCenterFor(mapPoints[0])

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200">
      <MapContainer center={initialCenter} zoom={locations.length ? 12 : 4} scrollWheelZoom className="h-[280px] w-full">
        <TileLayer url={tileUrl} attribution={attribution} />
        <FitLocations locations={locations} />
        {isValidLocation(userLocation) && (
          <CircleMarker center={mapCenterFor(userLocation)} radius={9} pathOptions={{ color: '#1d4ed8', fillColor: '#60a5fa', fillOpacity: 0.95 }}>
            <Popup>Your pickup location</Popup>
          </CircleMarker>
        )}
        {mappedCenters.map((center) => (
          <CircleMarker
            key={center.id}
            center={mapCenterFor(center)}
            radius={center.id === selectedCenterId ? 10 : 7}
            pathOptions={{ color: center.id === selectedCenterId ? '#b45309' : '#1b5e3a', fillColor: center.id === selectedCenterId ? '#fbbf24' : '#2bc48a', fillOpacity: 0.95 }}
            eventHandlers={{ click: () => onSelect?.(center.id) }}
          >
            <Popup>{center.name}<br />{center.address}, {center.city}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
