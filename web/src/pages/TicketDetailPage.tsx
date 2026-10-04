import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getCurrentUser } from '../api/auth'
import { getToken } from '../api/client'
import {
  addReply,
  assignTicket,
  Attachment,
  getTicket,
  resolveTicket,
  suggestReply,
  TicketCategory,
  TicketDetail,
  TicketPriority,
  TriageStatus,
  uploadAttachment,
} from '../api/tickets'
import StatusBadge from '../components/StatusBadge'
import { API_URL } from '../config'
import { errorMessage } from '../utils/errors'
import { categoryLabels, formatBytes, formatDate, priorityLabels } from '../utils/format'

function triageText(triageStatus: TriageStatus, category: TicketCategory | null, priority: TicketPriority | null) {
  if (triageStatus === 'pending') return 'Em triagem'
  if (triageStatus === 'failed') return 'Triagem falhou'
  return `${categoryLabels[category || ''] || '-'} / prioridade ${priorityLabels[priority || ''] || '-'}`
}

export default function TicketDetailPage() {
  const { id } = useParams()
  const user = getCurrentUser()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [error, setError] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [actionError, setActionError] = useState('')

  const load = useCallback(() => {
    getTicket(id!)
      .then(setTicket)
      .catch((err) => setError(err.message))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (ticket?.triageStatus !== 'pending') return
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [ticket?.triageStatus, load])

  async function run(action: () => Promise<unknown>) {
    setActionError('')
    try {
      await action()
      load()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  async function handleReply(e: FormEvent) {
    e.preventDefault()
    await run(async () => {
      await addReply(id!, body)
      setBody('')
    })
  }

  async function handleSuggest() {
    setActionError('')
    try {
      const data = await suggestReply(id!)
      setBody(data.suggestion)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    await run(async () => {
      await uploadAttachment(id!, file)
      setFile(null)
      ;(e.target as HTMLFormElement).reset()
    })
  }

  async function handleDownload(attachment: Attachment) {
    const res = await fetch(`${API_URL}/api/attachments/${attachment.id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!res.ok) {
      setActionError('Não foi possível baixar o anexo')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.originalName
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error) return <p className="error">{error}</p>
  if (!ticket || !user) return <p>Carregando...</p>

  const isStaff = user.role === 'agent' || user.role === 'admin'
  const canResolve = ticket.status === 'in_progress' && (user.role === 'admin' || ticket.assigneeId === user.id)

  return (
    <div>
      <h1>{ticket.title}</h1>
      <p>
        <StatusBadge status={ticket.status} /> &nbsp; {triageText(ticket.triageStatus, ticket.category, ticket.priority)}
      </p>
      <p className="muted">Aberto em {formatDate(ticket.createdAt)}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</p>

      {isStaff && (
        <div className="actions">
          {ticket.status !== 'resolved' && <button onClick={() => run(() => assignTicket(ticket.id))}>Assumir</button>}
          {canResolve && <button onClick={() => run(() => resolveTicket(ticket.id))}>Resolver</button>}
        </div>
      )}
      {actionError && <p className="error">{actionError}</p>}

      <h2>Conversa</h2>
      {ticket.replies.length === 0 && <p>Nenhuma resposta ainda.</p>}
      {ticket.replies.map((r) => (
        <div key={r.id} className="reply">
          <strong>{r.author.name}</strong> <span className="muted">{formatDate(r.createdAt)}</span>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.body}</p>
        </div>
      ))}

      <form onSubmit={handleReply}>
        <label>
          Responder
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <button type="submit">Enviar resposta</button>{' '}
        {isStaff && (
          <button type="button" onClick={handleSuggest}>
            Sugerir resposta
          </button>
        )}
      </form>

      <h2>Anexos</h2>
      {ticket.attachments.length === 0 && <p>Nenhum anexo.</p>}
      <ul>
        {ticket.attachments.map((a) => (
          <li key={a.id}>
            {a.originalName} ({formatBytes(a.sizeBytes)}){' '}
            <button type="button" onClick={() => handleDownload(a)}>
              Baixar
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleUpload}>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button type="submit" disabled={!file}>
          Enviar anexo
        </button>
      </form>
    </div>
  )
}
