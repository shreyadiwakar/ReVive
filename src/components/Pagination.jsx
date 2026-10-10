import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-charcoal/60">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-mint-light"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-mint-light"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
