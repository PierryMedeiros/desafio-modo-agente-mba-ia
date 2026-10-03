import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '../api/auth'
import { listTickets, TicketPage } from '../api/tickets'
import StatusBadge from '../components/StatusBadge'
import { formatDate } from '../utils/format'

export default function TicketsPage() {
  const user = getCurrentUser()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TicketPage | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listTickets(status, page)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [status, page])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div>
      <h1>{user?.role === 'customer' ? 'Meus chamados' : 'Chamados'}</h1>
      {user?.role !== 'customer' && (
        <label className="filter">
          Status:{' '}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Todos</option>
            <option value="open">Aberto</option>
            <option value="in_progress">Em andamento</option>
            <option value="resolved">Resolvido</option>
          </select>
        </label>
      )}
      {error && <p className="error">{error}</p>}
      {data && data.items.length === 0 && <p>Nenhum chamado.</p>}
      {data && data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Status</th>
              <th>Aberto em</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tickets/${t.id}`}>{t.title}</Link>
                </td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
                <td>{formatDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && totalPages > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
