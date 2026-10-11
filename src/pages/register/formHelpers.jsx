export function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-charcoal">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function inputClass(error) {
  return `w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${
    error ? 'border-red-300 focus:ring-red-100' : 'border-emerald-200 focus:border-forest focus:ring-forest/20'
  }`
}
