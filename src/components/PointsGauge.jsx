export default function PointsGauge({ points, goal = 10000, label = 'Reward progress' }) {
  const pct = Math.min(100, Math.round((points / goal) * 100))
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="mx-auto max-w-[220px] text-center">
      <div className="relative">
        <svg viewBox="0 0 120 120" className="block w-full" aria-hidden>
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e2ebe6" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#1b5e3a"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="text-xl font-bold text-charcoal leading-tight">{(points ?? 0).toLocaleString()}</span>
          <span className="text-xs text-charcoal/50">points</span>
          <span className="mt-1 text-[0.7rem] font-medium text-forest">{pct}% to next tier</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-charcoal/60">{label}</p>
    </div>
  )
}
