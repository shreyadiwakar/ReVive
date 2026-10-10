import { Check, Circle, X } from 'lucide-react'
import { PICKUP_STATUS, PICKUP_STATUS_ORDER } from '../utils/constants'
import { formatDateTime } from '../utils/format'

export default function PickupTimeline({ pickup }) {
  const isCancelled = pickup.status === PICKUP_STATUS.CANCELLED
  const timeline = pickup.timeline || []
  const currentIndex = PICKUP_STATUS_ORDER.indexOf(pickup.status)

  if (isCancelled) {
    return (
      <ol className="space-y-5">
        {timeline.map((entry, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              {entry.status === PICKUP_STATUS.CANCELLED ? <X size={14} /> : <Check size={14} />}
            </span>
            <div>
              <p className="text-sm font-semibold text-charcoal">{entry.status}</p>
              <p className="text-xs text-charcoal/50">{formatDateTime(entry.at)}</p>
              {entry.note && <p className="mt-0.5 text-sm text-charcoal/70">{entry.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    )
  }

  return (
    <ol className="space-y-5">
      {PICKUP_STATUS_ORDER.map((status, i) => {
        const entry = timeline.filter((t) => t.status === status).pop()
        const done = i <= currentIndex
        return (
          <li key={status} className="flex gap-3">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                done ? 'bg-forest text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {done ? <Check size={14} /> : <Circle size={10} fill="currentColor" />}
            </span>
            <div>
              <p className={`text-sm font-semibold ${done ? 'text-charcoal' : 'text-charcoal/40'}`}>{status}</p>
              {entry ? (
                <>
                  <p className="text-xs text-charcoal/50">{formatDateTime(entry.at)}</p>
                  {entry.note && <p className="mt-0.5 text-sm text-charcoal/70">{entry.note}</p>}
                </>
              ) : (
                <p className="text-xs text-charcoal/40">Pending</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
