import { Mail, Phone, Recycle } from 'lucide-react'
import { Link } from 'react-router-dom'

const FAQS = [
  { q: 'Is ReVive free to use?', a: 'Yes — scheduling pickups and earning points is free for residents.' },
  { q: 'How are reward points calculated?', a: 'Points are based on the verified weight of recycled material and category-specific rates.' },
  { q: 'When do I receive my points?', a: 'Only after a recycling center verifies the collected waste — not when you schedule a pickup.' },
]

export default function Footer() {
  return (
    <footer className="border-t border-emerald-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2 text-forest">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-white">
                <Recycle size={16} />
              </span>
              <span className="text-lg font-bold">ReVive</span>
            </Link>
            <p className="mt-3 text-sm text-charcoal/60">
              Turning everyday waste into verified recycling outcomes and real rewards.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-charcoal">Platform</h3>
            <ul className="mt-3 space-y-2 text-sm text-charcoal/60">
              <li><a href="#about" className="hover:text-forest">About</a></li>
              <li><a href="#how-it-works" className="hover:text-forest">How it works</a></li>
              <li><a href="#rewards" className="hover:text-forest">Rewards</a></li>
              <li><Link to="/register" className="hover:text-forest">Become a partner</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-charcoal">FAQs</h3>
            <ul className="mt-3 space-y-3">
              {FAQS.map((f) => (
                <li key={f.q}>
                  <p className="text-sm font-medium text-charcoal">{f.q}</p>
                  <p className="text-sm text-charcoal/60">{f.a}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-emerald-100 pt-6 text-sm text-charcoal/60 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} ReVive — Frontend prototype. Not a live commercial service.</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Mail size={14} /> hello@revive.demo</span>
            <span className="flex items-center gap-1.5"><Phone size={14} /> +91 80000 00000</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
