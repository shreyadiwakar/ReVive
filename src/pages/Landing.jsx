import {
  Clock,
  Factory,
  Gift,
  Leaf,
  MapPin,
  Recycle,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { roleHomePath, useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'

const STEPS = [
  { icon: Recycle, title: 'Schedule a pickup', text: 'Pick a waste category, quantity, and a time that works for you.' },
  { icon: Truck, title: 'Delivery partner collects', text: 'A verified delivery partner picks up your waste from your doorstep.' },
  { icon: Factory, title: 'Center verifies it', text: 'The recycling center confirms the weight and verifies the material.' },
  { icon: Gift, title: 'Earn & redeem rewards', text: 'Verified recycling earns points you can redeem for coupons or cash.' },
]

const BENEFITS = [
  {
    icon: Users,
    title: 'For residents',
    items: ['Schedule pickups in minutes', 'Track every request in real time', 'Earn points for verified recycling'],
  },
  {
    icon: Truck,
    title: 'For delivery partners',
    items: ['Flexible pickup jobs nearby', 'Simple status updates', 'Transparent earnings tracking'],
  },
  {
    icon: Factory,
    title: 'For recycling centers',
    items: ['Manage incoming material', 'Verify and log processed waste', 'Build a trusted public profile'],
  },
]

const FALLBACK_COUPONS = [
  { id: 'coupon_tree', title: 'Plant a Tree Certificate', partner: 'ReVive Impact Fund', pointsCost: 500, category: 'Impact' },
  { id: 'coupon_cash', title: '₹100 Cash Reward (simulated UPI)', partner: 'ReVive Wallet', pointsCost: 1200, category: 'Cash' },
  { id: 'coupon_grocery', title: '₹250 Grocery Voucher', partner: 'FreshMart', pointsCost: 2000, category: 'Grocery' },
  { id: 'coupon_movie', title: 'Movie Ticket Voucher', partner: 'CineStar', pointsCost: 1600, category: 'Entertainment' },
]

export default function Landing() {
  const { db, loading, backendEnabled } = useAppData()
  const { user } = useAuth()
  const residentAction = user ? roleHomePath(user.role) : '/register'
  const partnerAction = user ? roleHomePath(user.role) : '/register'
  const centers = (db?.centers || []).filter((c) => c.available).slice(0, 3)
  const coupons = (db?.coupons || [])
    .filter((coupon) => coupon.active !== false)
    .sort((a, b) => Number(a.pointsCost || 0) - Number(b.pointsCost || 0))
    .slice(0, 4)
  const featuredCoupons = coupons.length > 0 ? coupons : FALLBACK_COUPONS

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <section className="relative overflow-hidden bg-gradient-to-b from-mint-light to-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:gap-12 sm:py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
              <Sparkles size={14} /> Sustainability-first marketplace
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-charcoal sm:text-4xl md:text-5xl">
              Turn Your Waste Into Worth.
            </h1>
            <p className="mt-5 max-w-lg text-base text-charcoal/70 sm:text-lg">
              ReVive connects households to verified recycling centers through trusted delivery
              partners — so every pickup turns into tracked, rewarded impact.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={residentAction}
                className="rounded-xl bg-forest px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-forest-dark transition"
              >
                Recycle Now
              </Link>
              <Link
                to={partnerAction}
                className="rounded-xl border border-forest px-6 py-3 text-sm font-semibold text-forest hover:bg-mint-light transition"
              >
                Become a Partner
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-3xl bg-forest p-8 text-white shadow-lg">
            <Leaf size={32} />
            <p className="mt-5 text-2xl font-bold">From doorstep to recycling center</p>
            <p className="mt-2 text-sm text-white/75">Follow each pickup as it moves through collection and center verification.</p>
            <div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs font-medium">
              <span className="rounded-xl bg-white/10 px-2 py-3">Schedule</span>
              <span className="rounded-xl bg-white/10 px-2 py-3">Collect</span>
              <span className="rounded-xl bg-white/10 px-2 py-3">Verify</span>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl px-4 py-14 sm:py-20 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-charcoal sm:text-3xl">Built for a circular economy</h2>
          <p className="mt-4 text-charcoal/70">
            ReVive is a multi-sided marketplace, like the delivery platforms you already know —
            except every transaction keeps material out of landfills and rewards the people who
            make it happen.
          </p>
        </div>
        <div className="mt-8 grid gap-5 sm:mt-12 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-light text-forest">
                <b.icon size={22} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-charcoal">{b.title}</h3>
              <ul className="mt-3 space-y-2 text-sm text-charcoal/70">
                {b.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-forest" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-mint-light py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-charcoal">How It Works</h2>
            <p className="mt-4 text-charcoal/70">From doorstep to verified recycling in four simple steps.</p>
          </div>
          <div className="mt-8 grid gap-5 sm:mt-12 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
                <span className="absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">
                  {i + 1}
                </span>
                <step.icon className="text-forest" size={26} />
                <h3 className="mt-4 font-semibold text-charcoal">{step.title}</h3>
                <p className="mt-2 text-sm text-charcoal/60">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-charcoal sm:text-3xl">Featured recycling centers</h2>
            <p className="mt-2 text-charcoal/70">Verified partners currently accepting material near you.</p>
          </div>
          <Link to={residentAction} className="text-sm font-semibold text-forest hover:underline">
            Browse all centers →
          </Link>
        </div>
        {centers.length > 0 ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {centers.map((c) => (
            <div key={c.id} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-charcoal">{c.name}</h3>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-charcoal/60">
                <MapPin size={14} /> {c.address}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-charcoal/60">
                <Clock size={14} /> {c.operatingHours}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.acceptedCategories.map((cat) => (
                  <span key={cat} className="rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-medium text-forest">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div> : <p className="mt-8 rounded-2xl border border-emerald-100 bg-white p-6 text-sm text-charcoal/60">No recycling centers are listed yet.</p>}
      </section>

      <section id="rewards" className="bg-mint-light py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
            <h2 className="text-2xl font-bold text-charcoal sm:text-3xl">Available rewards</h2>
              <p className="mt-2 text-charcoal/70">Earn points when a center verifies your pickup, then redeem them for rewards.</p>
            </div>
          </div>
          {featuredCoupons.length > 0 ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCoupons.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100">
                <Gift className="text-forest" size={22} />
                <h3 className="mt-3 text-sm font-semibold text-charcoal">{r.title}</h3>
                <p className="mt-1 text-xs text-charcoal/50">{r.partner}</p>
                <p className="mt-3 text-sm font-bold text-forest">{Number(r.pointsCost || 0).toLocaleString()} pts</p>
              </div>
            ))}
          </div> : loading && backendEnabled
            ? <p role="status" className="mt-8 rounded-2xl border border-emerald-100 bg-white p-6 text-sm text-charcoal/60">Loading available rewards…</p>
            : <p className="mt-8 rounded-2xl border border-emerald-100 bg-white p-6 text-sm text-charcoal/60">No rewards are available right now.</p>}
          <div className="mt-8 text-center sm:mt-10">
            <Link
              to={residentAction}
              className="inline-flex rounded-xl bg-forest px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-forest-dark transition"
            >
              Start earning rewards
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
