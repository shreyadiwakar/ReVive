import { Info } from 'lucide-react'

export default function SimulatedBanner({ compact = false }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-950 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      }`}
      role="status"
    >
      <Info size={compact ? 14 : 16} className="shrink-0" aria-hidden />
      <span>
        Demo mode: data is simulated in your browser (localStorage). Not secure for production.
      </span>
    </div>
  )
}
