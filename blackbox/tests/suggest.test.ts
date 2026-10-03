import { describe, expect, it } from 'vitest'
import { createTicket, loginSeed, newCustomer, request, unique } from './helpers'

describe('sugestão de resposta', () => {
  it('atendente e admin recebem a sugestão fake', async () => {
    const name = `Fulana ${unique('n')}`
    const customer = await newCustomer(name)
    const title = unique('Ajuda com o painel')
    const ticket = await createTicket(customer.token, title)
    for (const who of ['agent', 'admin'] as const) {
      const { token } = await loginSeed(who)
      const res = await request(`/api/tickets/${ticket.id}/suggest-reply`, { method: 'POST', token })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        suggestion: `Olá, ${name}! Recebemos o seu chamado "${title}" e a nossa equipe já está analisando.`,
      })
    }
  })

  it('cliente não pede sugestão', async () => {
    const customer = await newCustomer()
    const ticket = await createTicket(customer.token)
    const res = await request(`/api/tickets/${ticket.id}/suggest-reply`, { method: 'POST', token: customer.token })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('forbidden')
  })

  it('chamado inexistente responde 404', async () => {
    const { token } = await loginSeed('agent')
    const res = await request('/api/tickets/00000000-0000-0000-0000-000000000000/suggest-reply', { method: 'POST', token })
    expect(res.status).toBe(404)
  })

  it('sem token responde 401', async () => {
    const res = await request('/api/tickets/qualquer/suggest-reply', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})
