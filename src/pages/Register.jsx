import { ArrowLeft, ArrowRight, Factory, Truck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import SimulatedBanner from '../components/SimulatedBanner'

const ROLE_CARDS = [
  {
    to: '/register/user',
    icon: Users,
    title: 'Resident',
    description: 'Schedule pickups, track recycling, and earn reward points.',
  },
  {
    to: '/register/delivery',
    icon: Truck,
    title: 'Delivery partner',
    description: 'Collect waste from residents and deliver it to recycling centers.',
  },
  {
    to: '/register/center',
    icon: Factory,
    title: 'Recycling center',
    description: 'Receive, verify, and process incoming recyclable material.',
  },
]

export default function Register() {
  return (
    <div className="min-h-screen bg-mint-light px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-charcoal/60 hover:text-forest">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div className="mt-6 text-center">
          <h1 className="text-3xl font-bold text-charcoal">Join ReVive</h1>
          <p className="mt-2 text-charcoal/60">Choose how you'd like to take part in the recycling marketplace.</p>
        </div>

        <div className="mx-auto mt-4 max-w-sm">
          <SimulatedBanner compact />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {ROLE_CARDS.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint-light text-forest">
                <card.icon size={24} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-charcoal">{card.title}</h2>
              <p className="mt-2 text-sm text-charcoal/60">{card.description}</p>
              <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-forest">
                Register <ArrowRight size={14} className="transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-charcoal/60">
          Already have an account? <Link to="/login" className="font-semibold text-forest hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
