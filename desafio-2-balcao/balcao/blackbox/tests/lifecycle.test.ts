import { describe, expect, it } from 'vitest'
import { createTicket, loginSeed, newCustomer, request } from './helpers'

async function setup() {
  const customer = await newCustomer()
  const agent = await loginSeed('agent')
  const admin = await loginSeed('admin')
  const ticket = await createTicket(customer.token)
  return { customer, agent, admin, ticket }
}

describe('ciclo do chamado', () => {
  it('atendente assume e resolve', async () => {
    const { agent, ticket } = await setup()
    const assigned = await request(`/api/tickets/${ticket.id}/assign`, { method: 'POST', token: agent.token })
    expect(assigned.status).toBe(200)
    expect(assigned.body.status).toBe('in_progress')
    expect(assigned.body.assigneeId).toBe(agent.user.id)

    const resolved = await request(`/api/tickets/${ticket.id}/resolve`, { method: 'POST', token: agent.token })
    expect(resolved.status).toBe(200)
    expect(resolved.body.status).toBe('resolved')
  })

  it('cliente não assume nem resolve', async () => {
    const { customer, ticket } = await setup()
    const assign = await request(`/api/tickets/${ticket.id}/assign`, { method: 'POST', token: customer.token })
    expect(assign.status).toBe(403)
    expect(assign.body.error).toBe('forbidden')
    const resolve = await request(`/api/tickets/${ticket.id}/resolve`, { method: 'POST', token: customer.token })
    expect(resolve.status).toBe(403)
  })

  it('chamado em andamento pode ser assumido por outro', async () => {
    const { agent, admin, ticket } = await setup()
    await request(`/api/tickets/${ticket.id}/assign`, { method: 'POST', token: agent.token })
    const res = await request(`/api/tickets/${ticket.id}/assign`, { method: 'POST', token: admin.token })
    expect(res.status).toBe(200)
    expect(res.body.assigneeId).toBe(admin.user.id)
    expect(res.body.status).toBe('in_progress')
  })

  it('chamado resolvido não pode ser assumido', async () => {
    const { agent, ticket } = await setup()
    await request(`/api/tickets/${ticket.id}/assign`, { method: 'POST', token: agent.token })
    await request(`/api/tickets/${ticket.id}/resolve`, { method: 'POST', token: agent.token })
    const res = await request(`/api/tickets/${ticket.id}/assign`, { method: 'POST', token: agent.token })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('invalid_transition')
  })

  it('só chamado em andamento pode ser resolvido', async () => {
    const { admin, ticket } = await setup()
    const res = await request(`/api/tickets/${ticket.id}/resolve`, { method: 'POST', token: admin.token })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('invalid_transition')
  })

  it('atendente que não assumiu não resolve, admin resolve', async () => {
    const { agent, admin, ticket } = await setup()
    await request(`/api/tickets/${ticket.id}/assign`, { method: 'POST', token: admin.token })
    const denied = await request(`/api/tickets/${ticket.id}/resolve`, { method: 'POST', token: agent.token })
    expect(denied.status).toBe(403)
    expect(denied.body.error).toBe('forbidden')

    const ok = await request(`/api/tickets/${ticket.id}/resolve`, { method: 'POST', token: admin.token })
    expect(ok.status).toBe(200)
    expect(ok.body.status).toBe('resolved')
  })

  it('atendente que não assumiu recebe 403 antes do 409', async () => {
    const { agent, ticket } = await setup()
    const res = await request(`/api/tickets/${ticket.id}/resolve`, { method: 'POST', token: agent.token })
    expect(res.status).toBe(403)
  })

  it('cliente de outro chamado recebe 404 nas ações', async () => {
    const { ticket } = await setup()
    const other = await newCustomer()
    const reply = await request(`/api/tickets/${ticket.id}/replies`, {
      method: 'POST',
      token: other.token,
      json: { body: 'Intrometido' },
    })
    expect(reply.status).toBe(404)
  })

  it('ações em chamado inexistente respondem 404', async () => {
    const { agent } = await setup()
    const id = '00000000-0000-0000-0000-000000000000'
    expect((await request(`/api/tickets/${id}/assign`, { method: 'POST', token: agent.token })).status).toBe(404)
    expect((await request(`/api/tickets/${id}/resolve`, { method: 'POST', token: agent.token })).status).toBe(404)
  })
})

describe('respostas', () => {
  it('cliente, atendente e admin respondem', async () => {
    const { customer, agent, admin, ticket } = await setup()
    for (const [who, token] of [
      ['cliente', customer.token],
      ['atendente', agent.token],
      ['admin', admin.token],
    ]) {
      const res = await request(`/api/tickets/${ticket.id}/replies`, { method: 'POST', token, json: { body: `Oi do ${who}` } })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ ticketId: ticket.id, body: `Oi do ${who}` })
      expect(res.body.id).toEqual(expect.any(String))
      expect(res.body.authorId).toEqual(expect.any(String))
      expect(res.body.createdAt).toEqual(expect.any(String))
    }
    const detail = await request(`/api/tickets/${ticket.id}`, { token: customer.token })
    expect(detail.body.replies.map((r: any) => r.body)).toEqual(['Oi do cliente', 'Oi do atendente', 'Oi do admin'])
  })

  it('valida o corpo da resposta', async () => {
    const { customer, ticket } = await setup()
    for (const json of [{ body: '' }, { body: 'x'.repeat(5001) }, {}]) {
      const res = await request(`/api/tickets/${ticket.id}/replies`, { method: 'POST', token: customer.token, json })
      expect(res.status).toBe(422)
      expect(res.body.error).toBe('validation_error')
    }
  })

  it('resposta do cliente reabre chamado resolvido mantendo o responsável', async () => {
    const { customer, agent, ticket } = await setup()
    await request(`/api/tickets/${ticket.id}/assign`, { method: 'POST', token: agent.token })
    await request(`/api/tickets/${ticket.id}/resolve`, { method: 'POST', token: agent.token })

    const reply = await request(`/api/tickets/${ticket.id}/replies`, {
      method: 'POST',
      token: customer.token,
      json: { body: 'O problema voltou' },
    })
    expect(reply.status).toBe(201)

    const detail = await request(`/api/tickets/${ticket.id}`, { token: customer.token })
    expect(detail.body.status).toBe('open')
    expect(detail.body.assigneeId).toBe(agent.user.id)
  })

  it('resposta do atendente não reabre', async () => {
    const { customer, agent, ticket } = await setup()
    await request(`/api/tickets/${ticket.id}/assign`, { method: 'POST', token: agent.token })
    await request(`/api/tickets/${ticket.id}/resolve`, { method: 'POST', token: agent.token })
    await request(`/api/tickets/${ticket.id}/replies`, { method: 'POST', token: agent.token, json: { body: 'Fechado' } })
    const detail = await request(`/api/tickets/${ticket.id}`, { token: customer.token })
    expect(detail.body.status).toBe('resolved')
  })
})
