import { statusLabels } from '../utils/format'

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{statusLabels[status] || status}</span>
}
