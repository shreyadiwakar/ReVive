const STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-red-100 text-red-700',
}

export default function ApprovalBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STYLES[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
