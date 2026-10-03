import { describe, expect, it } from 'vitest'
import { createTicket, loginSeed, newCustomer, request, unique } from './helpers'

const TICKET_FIELDS = [
  'assigneeId',
  'category',
  'createdAt',
  'customerId',
  'description',
  'id',
  'priority',
  'status',
  'title',
  'triageStatus',
  'updatedAt',
]

describe('chamados', () => {
  it('cliente abre chamado aberto, pendente e sem triagem', async () => {
    const { token, user } = await newCustomer()
    const title = unique('Abrir')
    const res = await request('/api/tickets', {
      method: 'POST',
      token,
      json: { title, description: 'Descrição com mais de dez caracteres' },
    })
    expect(res.status).toBe(201)
    for (const field of TICKET_FIELDS) expect(res.body).toHaveProperty(field)
    expect(res.body).toMatchObject({
      title,
      status: 'open',
      triageStatus: 'pending',
      category: null,
      priority: null,
      customerId: user.id,
      assigneeId: null,
    })
    expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt)
  })

  it('atendente e admin não abrem chamado', async () => {
    for (const who of ['agent', 'admin'] as const) {
      const { token } = await loginSeed(who)
      const res = await request('/api/tickets', {
        method: 'POST',
        token,
        json: { title: 'Título válido', description: 'Descrição com mais de dez caracteres' },
      })
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('forbidden')
    }
  })

  it('valida título e descrição com 422', async () => {
    const { token } = await newCustomer()
    const cases = [
      { title: 'ab', description: 'Descrição com mais de dez caracteres' },
      { title: 'x'.repeat(121), description: 'Descrição com mais de dez caracteres' },
      { title: 'Título válido', description: 'curta' },
      { title: 'Título válido', description: 'x'.repeat(5001) },
      {},
    ]
    for (const json of cases) {
      const res = await request('/api/tickets', { method: 'POST', token, json })
      expect(res.status).toBe(422)
      expect(res.body.error).toBe('validation_error')
    }
  })

  it('sem token responde 401', async () => {
    const res = await request('/api/tickets')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('unauthorized')
  })

  it('cliente lista só os próprios chamados, mais recentes primeiro', async () => {
    const a = await newCustomer()
    const b = await newCustomer()
    const first = await createTicket(a.token)
    const second = await createTicket(a.token)
    await createTicket(b.token)

    const res = await request('/api/tickets', { token: a.token })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 2 })
    expect(res.body.items.map((t: any) => t.id)).toEqual([second.id, first.id])
  })

  it('atendente vê chamados de todos e filtra por status', async () => {
    const customer = await newCustomer()
    const ticket = await createTicket(customer.token)
    const { token } = await loginSeed('agent')

    const all = await request('/api/tickets', { token })
    expect(all.status).toBe(200)
    expect(all.body.pageSize).toBe(20)
    expect(all.body.items.length).toBeLessThanOrEqual(20)
    expect(all.body.items[0].id).toBe(ticket.id)

    const open = await request('/api/tickets?status=open', { token })
    expect(open.body.items.every((t: any) => t.status === 'open')).toBe(true)
    const resolved = await request('/api/tickets?status=resolved', { token })
    expect(resolved.body.items.every((t: any) => t.status === 'resolved')).toBe(true)
  })

  it('pagina de 20 em 20', async () => {
    const { token } = await newCustomer()
    for (let i = 0; i < 21; i++) await createTicket(token)
    const page1 = await request('/api/tickets?page=1', { token })
    const page2 = await request('/api/tickets?page=2', { token })
    expect(page1.body.items).toHaveLength(20)
    expect(page1.body.total).toBe(21)
    expect(page2.body.page).toBe(2)
    expect(page2.body.items).toHaveLength(1)
  })

  it('detalhe traz respostas e anexos', async () => {
    const { token } = await newCustomer()
    const ticket = await createTicket(token)
    const res = await request(`/api/tickets/${ticket.id}`, { token })
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(ticket.id)
    expect(res.body.replies).toEqual([])
    expect(res.body.attachments).toEqual([])
  })

  it('chamado de outro cliente responde 404', async () => {
    const owner = await newCustomer()
    const intruder = await newCustomer()
    const ticket = await createTicket(owner.token)
    const res = await request(`/api/tickets/${ticket.id}`, { token: intruder.token })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not_found')

    const seedCustomer = await loginSeed('customer')
    const res2 = await request(`/api/tickets/${ticket.id}`, { token: seedCustomer.token })
    expect(res2.status).toBe(404)
  })

  it('atendente e admin veem chamado de qualquer cliente', async () => {
    const owner = await newCustomer()
    const ticket = await createTicket(owner.token)
    for (const who of ['agent', 'admin'] as const) {
      const { token } = await loginSeed(who)
      const res = await request(`/api/tickets/${ticket.id}`, { token })
      expect(res.status).toBe(200)
    }
  })

  it('chamado inexistente responde 404', async () => {
    const { token } = await loginSeed('admin')
    const res = await request('/api/tickets/00000000-0000-0000-0000-000000000000', { token })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not_found')
  })
})
