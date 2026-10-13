import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-forest text-white shadow-sm' : 'text-charcoal/70 hover:bg-mint-light hover:text-forest'
  }`

function SidebarContent({ brand, navItems, user, onLogout, onNavigate }) {
  return (
    <>
      <Link to="/" aria-label="ReVive home" className="flex items-center gap-2 border-b border-emerald-100 px-2 pb-5">
        <span className="text-2xl" aria-hidden>♻️</span>
        <div>
          <strong className="block text-lg leading-tight text-forest">ReVive</strong>
          <span className="text-xs text-charcoal/50">{brand}</span>
        </div>
      </Link>
      <nav className="mt-5 flex flex-1 flex-col gap-1 px-1">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass} onClick={onNavigate}>
            <item.icon size={18} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-emerald-100 px-2 pt-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest font-bold text-white">
            {user?.name?.charAt(0) || '?'}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-charcoal">{user?.name}</div>
            <div className="truncate text-xs text-charcoal/50">{user?.email}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-charcoal hover:bg-mint-light"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </>
  )
}

export default function DashboardLayout({ brand, navItems }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="flex min-h-screen bg-mint-light">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-emerald-100 bg-white p-4 md:flex">
        <SidebarContent brand={brand} navItems={navItems} user={user} onLogout={handleLogout} onNavigate={closeMobile} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <aside className="relative z-50 flex h-full w-64 flex-col bg-white p-4 shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 text-charcoal/50"
              onClick={closeMobile}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            <SidebarContent brand={brand} navItems={navItems} user={user} onLogout={handleLogout} onNavigate={closeMobile} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-white px-4 py-3 md:hidden">
          <Link to="/" aria-label="ReVive home" className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>♻️</span>
            <strong className="text-forest">ReVive</strong>
          </Link>
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-charcoal">
            <Menu size={22} />
          </button>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
