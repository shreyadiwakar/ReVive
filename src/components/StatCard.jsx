export default function StatCard({ label, value, hint, trend, icon: Icon, tone = 'forest' }) {
  const toneClasses = {
    forest: 'bg-forest/10 text-forest',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-charcoal/50">{label}</div>
          <div className="mt-1.5 text-2xl font-bold text-charcoal">{value}</div>
          {trend && <div className="mt-1.5 text-sm font-semibold text-forest">{trend}</div>}
          {hint && !trend && <div className="mt-1.5 text-sm text-charcoal/50">{hint}</div>}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone] || toneClasses.forest}`}>
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  )
}
