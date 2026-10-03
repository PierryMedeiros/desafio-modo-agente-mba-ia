import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTicket } from '../api/tickets'

export default function NewTicketPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const ticket = await createTicket(title, description)
      navigate(`/tickets/${ticket.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1>Novo chamado</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </label>
        <label>
          Descrição
          <textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving}>
          Abrir chamado
        </button>
      </form>
    </div>
  )
}
