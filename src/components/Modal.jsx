import { X } from 'lucide-react'

export default function Modal({ open, title, onClose, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
      <div className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-charcoal">{title}</h2>
          <button type="button" onClick={onClose} className="text-charcoal/40 hover:text-charcoal" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
