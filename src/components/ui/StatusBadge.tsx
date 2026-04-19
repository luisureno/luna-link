const statusStyles: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  invoiced: 'bg-purple-100 text-purple-700',
  disputed: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  assigned: 'bg-gray-100 text-gray-600',
  acknowledged: 'bg-amber-100 text-amber-700',
  en_route: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
}

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${style}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
