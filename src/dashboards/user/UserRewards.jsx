import { Award, Check, Copy, Gift, History } from 'lucide-react'
import { useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import PointsGauge from '../../components/PointsGauge'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { redeemCoupon } from '../../services/dataService'
import { formatDateTime } from '../../utils/format'
import { backendEnabled, redeemBackendCoupon } from '../../services/backendApi'

function readSavedFulfillments(userId) {
  if (!userId) return {}
  try { return JSON.parse(localStorage.getItem(`revive:demo-fulfillments:${userId}`) || '{}') } catch { return {} }
}

function saveFulfillment(userId, transaction) {
  if (!userId || !transaction?.id) return
  try {
    const saved = readSavedFulfillments(userId)
    saved[transaction.id] = transaction
    localStorage.setItem(`revive:demo-fulfillments:${userId}`, JSON.stringify(saved))
  } catch { /* Keep the code available in the current session if storage is unavailable. */ }
}

export default function UserRewards() {
  const { user } = useAuth()
  const { db, refresh, loading, error } = useAppData()
  const toast = useToast()
  const [redeemTarget, setRedeemTarget] = useState(null)
  const [redeemRequestId, setRedeemRequestId] = useState(null)
  const [redeeming, setRedeeming] = useState(false)
  const [savedFulfillments, setSavedFulfillments] = useState(() => readSavedFulfillments(user?.id))
  const [lastFulfillment, setLastFulfillment] = useState(() => Object.values(readSavedFulfillments(user?.id)).slice(-1)[0] || null)
  const [copiedCode, setCopiedCode] = useState('')
  const [couponPage, setCouponPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)

  const balance = backendEnabled ? (db.rewardsBalance ?? 0) : (user?.points ?? 0)
  const availableCoupons = (db.coupons || []).filter((coupon) => coupon.active !== false)
  const history = db.rewardTransactions
    .filter((t) => t.userId === user.id)
    .map((transaction) => ({ ...transaction, ...savedFulfillments[transaction.id] }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const pageSize = 8
  const couponPages = Math.max(1, Math.ceil(availableCoupons.length / pageSize))
  const historyPages = Math.max(1, Math.ceil(history.length / pageSize))
  const safeCouponPage = Math.min(couponPage, couponPages)
  const safeHistoryPage = Math.min(historyPage, historyPages)
  const pageCoupons = availableCoupons.slice((safeCouponPage - 1) * pageSize, safeCouponPage * pageSize)
  const pageHistory = history.slice((safeHistoryPage - 1) * pageSize, safeHistoryPage * pageSize)

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode(''), 1800)
      toast.success('Demo code copied.')
    } catch {
      toast.error('Could not copy the code. Select and copy it manually.')
    }
  }

  const handleRedeem = async () => {
    if (!redeemTarget || redeeming) return
    setRedeeming(true)
    try {
      let transaction
      if (backendEnabled) {
        const result = await redeemBackendCoupon(redeemTarget.id, redeemRequestId)
        transaction = result.transaction
      } else {
        const result = redeemCoupon(user.id, redeemTarget.id)
        if (!result.ok) throw new Error(result.error)
        transaction = result.transaction
      }
      const requestCode = String(redeemRequestId).replace(/[^a-z0-9]/gi, '').toUpperCase()
      const partnerCode = String(redeemTarget.partner || 'REWARD').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'REWARD'
      const fulfillment = {
        ...transaction,
        id: transaction?.id || redeemRequestId,
        couponTitle: redeemTarget.title,
        createdAt: transaction?.createdAt || new Date().toISOString(),
        fulfillmentType: redeemTarget.category === 'Cash' ? 'cash_request' : 'demo_voucher',
        fulfillmentStatus: transaction?.fulfillmentStatus || 'completed',
        ...(redeemTarget.category === 'Cash' ? {} : {
          fulfillmentCode: transaction?.fulfillmentCode || `DEMO-${partnerCode}-${requestCode}`,
        }),
      }
      saveFulfillment(user.id, fulfillment)
      setSavedFulfillments((current) => ({ ...current, [fulfillment.id]: fulfillment }))
      setLastFulfillment(fulfillment)
      toast.success(redeemTarget.category === 'Cash'
        ? 'Points-to-cash conversion is done.'
        : `${redeemTarget.title} redeemed. Code: ${fulfillment.fulfillmentCode}`)
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
      {(lastFulfillment?.fulfillmentCode || lastFulfillment?.fulfillmentType === 'cash_request') && (
        <div role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {lastFulfillment.fulfillmentType === 'cash_request' ? (
            <>
              <p className="font-semibold">Points converted to cash</p>
              <p className="mt-1">Status: Done</p>
            </>
          ) : (
            <>
              <p className="font-semibold">Your voucher code</p>
              <p className="mt-1 font-mono font-bold tracking-wide">{lastFulfillment.fulfillmentCode}</p>
              <button type="button" onClick={() => copyCode(lastFulfillment.fulfillmentCode)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-forest hover:bg-emerald-100">
                {copiedCode === lastFulfillment.fulfillmentCode ? <Check size={14} /> : <Copy size={14} />}
                {copiedCode === lastFulfillment.fulfillmentCode ? 'Copied' : 'Copy code'}
              </button>
            </>
          )}
        </div>
      )}
      {backendEnabled && loading && <p className="mt-3 text-sm text-charcoal/60">Loading rewards…</p>}
      {backendEnabled && error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>}

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm border border-emerald-100">
        <PointsGauge points={balance} rewards={availableCoupons} label="Available balance" />
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold text-charcoal">
        <Gift size={16} /> Available coupons
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageCoupons.map((r) => {
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
                {canRedeem ? (r.category === 'Cash' ? 'Request cash conversion' : 'Redeem') : 'Not enough points'}
              </button>
            </div>
          )
        })}
      </div>
      <Pagination page={safeCouponPage} totalPages={couponPages} onChange={setCouponPage} />

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
                <th className="px-5 py-3">Demo fulfilment</th>
                <th className="px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pageHistory.map((t) => (
                <tr key={t.id} className="border-b border-emerald-50 last:border-0">
                  <td className="px-5 py-3 text-charcoal/60">{formatDateTime(t.createdAt)}</td>
                  <td className="px-5 py-3 text-charcoal">{t.description}</td>
                  <td className="px-5 py-3 text-charcoal/70">
                    {t.fulfillmentType === 'cash_request' ? (
                      <span className="text-xs font-medium text-emerald-700">Done</span>
                    ) : t.fulfillmentCode ? (
                      <span>
                        <span className="block text-xs text-charcoal/50">Voucher</span>
                        <span className="font-mono text-xs font-semibold text-forest">{t.fulfillmentCode}</span>
                        <button type="button" onClick={() => copyCode(t.fulfillmentCode)} className="ml-2 inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-[10px] font-semibold text-forest hover:bg-mint-light">
                          {copiedCode === t.fulfillmentCode ? <Check size={12} /> : <Copy size={12} />}
                          {copiedCode === t.fulfillmentCode ? 'Copied' : 'Copy'}
                        </button>
                      </span>
                    ) : '—'}
                  </td>
                  <td className={`px-5 py-3 font-semibold ${t.amount > 0 ? 'text-forest' : 'text-red-600'}`}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 pb-5">
            <Pagination page={safeHistoryPage} totalPages={historyPages} onChange={setHistoryPage} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!redeemTarget}
        title={redeemTarget?.category === 'Cash' ? 'Request points-to-cash conversion' : 'Confirm redemption'}
        message={redeemTarget?.category === 'Cash'
          ? `Convert ${redeemTarget?.pointsCost?.toLocaleString()} points to cash? Points will be deducted and the conversion will be marked done in your reward history.`
          : `Redeem "${redeemTarget?.title}" for ${redeemTarget?.pointsCost?.toLocaleString()} points? The points will be deducted and the redemption saved in your reward history.`}
        confirmLabel={redeemTarget?.category === 'Cash' ? 'Submit request' : 'Redeem'}
        onConfirm={handleRedeem}
        onCancel={() => { setRedeemTarget(null); setRedeemRequestId(null) }}
        busy={redeeming}
      />
    </div>
  )
}
