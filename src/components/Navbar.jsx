import { Menu, Recycle, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const LINKS = [
  { href: '#about', label: 'About' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#rewards', label: 'Rewards' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2 text-forest">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-white">
            <Recycle size={20} />
          </span>
          <span className="text-xl font-bold">ReVive</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-charcoal/70 hover:text-forest">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/login" className="text-sm font-semibold text-charcoal hover:text-forest">
            Login
          </Link>
          <Link to="/register" className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-forest-dark transition">
            Get Started
          </Link>
        </div>

        <button type="button" className="text-charcoal md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-emerald-100 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-charcoal/70" onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <Link to="/login" className="text-sm font-semibold text-charcoal" onClick={() => setOpen(false)}>
              Login
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-forest px-4 py-2 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Get Started
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
