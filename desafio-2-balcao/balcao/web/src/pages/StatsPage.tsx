import { useEffect, useState } from 'react'
import { getCurrentUser } from '../api/auth'
import { getStats, Stats } from '../api/stats'
import { categoryLabels, priorityLabels, statusLabels } from '../utils/format'

function StatsTable({ title, data, labels }: { title: string; data: Record<string, number>; labels: Record<string, string> }) {
  return (
    <>
      <h2>{title}</h2>
      <table>
        <tbody>
          {Object.entries(data).map(([key, value]) => (
            <tr key={key}>
              <td>{key === 'untriaged' ? 'Sem triagem' : labels[key] || key}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export default function StatsPage() {
  const user = getCurrentUser()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.role !== 'admin') return
    getStats()
      .then(setStats)
      .catch((err) => setError(err.message))
  }, [])

  if (user?.role !== 'admin') return <p className="error">Acesso restrito ao admin.</p>
  if (error) return <p className="error">{error}</p>
  if (!stats) return <p>Carregando...</p>

  return (
    <div>
      <h1>Estatísticas</h1>
      <StatsTable title="Por status" data={stats.byStatus} labels={statusLabels} />
      <StatsTable title="Por categoria" data={stats.byCategory} labels={categoryLabels} />
      <StatsTable title="Por prioridade" data={stats.byPriority} labels={priorityLabels} />
    </div>
  )
}
