export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-white/60 px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 text-forest/40" size={40} strokeWidth={1.5} />}
      <h3 className="text-lg font-semibold text-charcoal">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-charcoal/60">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
