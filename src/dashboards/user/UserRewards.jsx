import { Award, Gift, History } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import PointsGauge from '../../components/PointsGauge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { redeemCoupon } from '../../services/dataService'
import { formatDateTime } from '../../utils/format'
import { backendEnabled, redeemBackendCoupon } from '../../services/backendApi'

export default function UserRewards() {
  const { user } = useAuth()
  const { db, refresh, loading, error } = useAppData()
  const toast = useToast()
  const [redeemTarget, setRedeemTarget] = useState(null)
  const [redeemRequestId, setRedeemRequestId] = useState(null)
  const [redeeming, setRedeeming] = useState(false)

  const balance = backendEnabled ? (db.rewardsBalance ?? 0) : (user?.points ?? 0)
  const history = db.rewardTransactions
    .filter((t) => t.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const handleRedeem = async () => {
    if (!redeemTarget || redeeming) return
    setRedeeming(true)
    try {
      if (backendEnabled) {
        await redeemBackendCoupon(redeemTarget.id, redeemRequestId)
      } else {
        const result = redeemCoupon(user.id, redeemTarget.id)
        if (!result.ok) throw new Error(result.error)
      }
      toast.success(`${redeemTarget.title} redeemed. Points have been deducted.`)
      setRedeemTarget(null)
      setRedeemRequestId(null)
      refresh()
    } catch (error) {
      toast.error(error.message || 'Could not redeem this reward.')
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Rewards</h1>
      <p className="mt-1 text-charcoal/60">Redeem points for coupons, gift cards, and other rewards.</p>
      {backendEnabled && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">Your points and redemption history are saved by the backend. Reward fulfilment, such as issuing voucher codes or transferring cash, is not connected yet.</p>}
      {backendEnabled && loading && <p className="mt-3 text-sm text-charcoal/60">Loading rewards…</p>}
      {backendEnabled && error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>}

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
        <PointsGauge points={balance} rewards={db.coupons} label="Available balance" />
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold text-charcoal">
        <Gift size={16} /> Available coupons
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {db.coupons.map((r) => {
          const canRedeem = balance >= r.pointsCost
          return (
            <div key={r.id} className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-100/70">
              <span className="rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-medium text-forest">{r.category}</span>
              <h3 className="mt-3 font-semibold text-charcoal">{r.title}</h3>
              <p className="text-xs text-charcoal/50">{r.partner}</p>
              <p className="mt-2 text-sm font-bold text-charcoal">{r.pointsCost.toLocaleString()} points</p>
              <button
                type="button"
                disabled={!canRedeem || redeeming}
                onClick={() => { setRedeemTarget(r); setRedeemRequestId(crypto.randomUUID()) }}
                className="mt-4 w-full rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 hover:bg-forest-dark transition"
              >
                {canRedeem ? 'Redeem' : 'Not enough points'}
              </button>
            </div>
          )
        })}
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold text-charcoal">
        <History size={16} /> Reward history
      </h2>
      {history.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={Award} title="No reward activity yet" description="Earn points by completing verified pickups." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm border border-emerald-100/70">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-50 text-xs uppercase tracking-wide text-charcoal/40">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t.id} className="border-b border-emerald-50 last:border-0">
                  <td className="px-5 py-3 text-charcoal/60">{formatDateTime(t.createdAt)}</td>
                  <td className="px-5 py-3 text-charcoal">{t.description}</td>
                  <td className={`px-5 py-3 font-semibold ${t.amount > 0 ? 'text-forest' : 'text-red-600'}`}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!redeemTarget}
        title="Confirm redemption"
        message={`Redeem "${redeemTarget?.title}" for ${redeemTarget?.pointsCost?.toLocaleString()} points? The points will be deducted and the redemption saved in your reward history.`}
        confirmLabel="Redeem"
        onConfirm={handleRedeem}
        onCancel={() => { setRedeemTarget(null); setRedeemRequestId(null) }}
        busy={redeeming}
      />
    </div>
  )
}
