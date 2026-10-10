import { Clock, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PendingApplication({ roleLabel, profilePath }) {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="rounded-2xl bg-white p-8 shadow-sm border border-emerald-100 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Clock size={28} />
        </div>
        <h1 className="text-2xl font-bold text-charcoal">Application under review</h1>
        <p className="mt-2 text-charcoal/70">
          Your {roleLabel} application is pending admin approval. You can update your profile while you wait.
        </p>
        <p className="mt-4 text-sm text-charcoal/60 flex items-center justify-center gap-2">
          <Mail size={16} /> We&apos;ll notify you here when status changes (simulated).
        </p>
        <Link
          to={profilePath}
          className="mt-6 inline-flex rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition"
        >
          View profile
        </Link>
      </div>
    </div>
  )
}
