import { Clock, MapPin, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { getRoadDistances, isValidLocation } from '../../services/mapServices'
import { WASTE_CATEGORIES } from '../../utils/constants'

export default function UserCenters() {
  const { db } = useAppData()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [selected, setSelected] = useState(null)
  const [distances, setDistances] = useState({})

  useEffect(() => {
    let active = true
    if (!isValidLocation(user)) {
      setDistances({})
      return () => { active = false }
    }
    getRoadDistances(user, db.centers.map((center) => ({
      id: center.id,
      location: { latitude: center.latitude, longitude: center.longitude },
    }))).then((result) => {
      if (!active) return
      setDistances(Object.fromEntries(result))
    })
    return () => { active = false }
  }, [user?.latitude, user?.longitude, db.centers])

  const centers = db.centers.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.address.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || c.acceptedCategories.includes(category)
    return matchesSearch && matchesCategory
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Recycling centers</h1>
      <p className="mt-1 text-charcoal/60">Browse verified centers and the categories they accept.</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search centers by name or address"
            className="w-full rounded-xl border border-emerald-200 py-2.5 pl-10 pr-3.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-emerald-200 px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        >
          <option value="All">All categories</option>
          {WASTE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {centers.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Search} title="No centers match your search" description="Try a different category or search term." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {centers.map((c) => (
            <div key={c.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-charcoal">{c.name}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {c.available ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-charcoal/60"><MapPin size={14} /> {c.address}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-charcoal/60"><Clock size={14} /> {c.operatingHours}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-forest">
                <MapPin size={14} />
                {isValidLocation(user)
                  ? distances[c.id] ? `${distances[c.id].km < 10 ? distances[c.id].km.toFixed(1) : Math.round(distances[c.id].km)} km by road` : 'Road distance unavailable'
                  : 'Add a saved map pin to see road distance'}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.acceptedCategories.map((cat) => (
                  <span key={cat} className="rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-medium text-forest">{cat}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="mt-4 w-full rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-charcoal hover:bg-mint-light transition"
              >
                View details
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} title={selected?.name} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-3 text-sm">
            <p className="text-charcoal/70">{selected.description}</p>
            <p className="flex items-center gap-1.5 text-charcoal/60"><MapPin size={14} /> {selected.address}, {selected.city}</p>
            <p className="flex items-center gap-1.5 font-medium text-forest"><MapPin size={14} />
              {isValidLocation(user)
                ? distances[selected.id] ? `${distances[selected.id].km < 10 ? distances[selected.id].km.toFixed(1) : Math.round(distances[selected.id].km)} km by road` : 'Road distance unavailable'
                : 'Add a saved map pin to see road distance'}
            </p>
            <p className="flex items-center gap-1.5 text-charcoal/60"><Clock size={14} /> {selected.operatingHours}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selected.acceptedCategories.map((cat) => (
                <span key={cat} className="rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-medium text-forest">{cat}</span>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
