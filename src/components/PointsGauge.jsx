export default function PointsGauge({ points = 0, rewards = [], label = 'Reward progress' }) {
  const balance = Math.max(0, Number(points) || 0)
  const sortedRewards = [...rewards]
    .filter((reward) => reward.active !== false && Number.isFinite(Number(reward.pointsCost)) && Number(reward.pointsCost) > 0)
    .sort((a, b) => Number(a.pointsCost) - Number(b.pointsCost))
  const redeemable = sortedRewards.find((reward) => Number(reward.pointsCost) <= balance)
  const nextReward = sortedRewards.find((reward) => Number(reward.pointsCost) > balance)
  const goal = nextReward ? Number(nextReward.pointsCost) : redeemable ? Number(redeemable.pointsCost) : 0
  const pct = goal ? Math.min(100, Math.round((balance / goal) * 100)) : 0
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="mx-auto max-w-[220px] text-center">
      <div className="relative" role="progressbar" aria-valuemin={0} aria-valuemax={goal || 1} aria-valuenow={goal ? Math.min(balance, goal) : 0} aria-label={nextReward ? `Progress toward ${nextReward.title}` : redeemable ? `${redeemable.title} is available to redeem` : 'No rewards available'}>
        <svg viewBox="0 0 120 120" className="block w-full" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e2ebe6" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#1b5e3a"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="text-xl font-bold text-charcoal leading-tight">{(points ?? 0).toLocaleString()}</span>
          <span className="text-xs text-charcoal/50">points</span>
          {nextReward ? (
            <span className="mt-1 max-w-[130px] text-[0.65rem] font-medium leading-tight text-forest">{pct}% to next reward</span>
          ) : redeemable ? (
            <span className="mt-1 text-[0.65rem] font-medium leading-tight text-forest">Reward available</span>
          ) : (
            <span className="mt-1 text-[0.65rem] font-medium leading-tight text-charcoal/50">No rewards listed</span>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm text-charcoal/60">{label}</p>
      {nextReward && <p className="mt-1 text-xs text-charcoal/60">{(Number(nextReward.pointsCost) - balance).toLocaleString()} more for {nextReward.title}</p>}
      {!nextReward && redeemable && <p className="mt-1 text-xs font-medium text-forest">You can redeem {redeemable.title}</p>}
      {!nextReward && !redeemable && <p className="mt-1 text-xs text-charcoal/50">Rewards will appear here when available.</p>}
    </div>
  )
}
