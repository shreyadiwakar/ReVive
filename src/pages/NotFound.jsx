import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-mint-light px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest/10 text-forest">
        <Compass size={32} />
      </div>
      <h1 className="mt-5 text-3xl font-bold text-charcoal">Page not found</h1>
      <p className="mt-2 max-w-sm text-charcoal/60">The page you're looking for doesn't exist or may have moved.</p>
      <Link to="/" className="mt-6 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark transition">
        Back to home
      </Link>
    </div>
  )
}
