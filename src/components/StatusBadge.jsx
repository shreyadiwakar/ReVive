import { PICKUP_STATUS } from '../utils/constants'

const styles = {
  [PICKUP_STATUS.REQUESTED]: 'bg-slate-100 text-slate-700',
  [PICKUP_STATUS.ACCEPTED]: 'bg-blue-100 text-blue-800',
  [PICKUP_STATUS.PICKUP_SCHEDULED]: 'bg-indigo-100 text-indigo-800',
  [PICKUP_STATUS.COLLECTED]: 'bg-violet-100 text-violet-800',
  [PICKUP_STATUS.DELIVERED]: 'bg-orange-100 text-orange-800',
  [PICKUP_STATUS.VERIFIED]: 'bg-emerald-100 text-emerald-800',
  [PICKUP_STATUS.CANCELLED]: 'bg-red-100 text-red-700',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
