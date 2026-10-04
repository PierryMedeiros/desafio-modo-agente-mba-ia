import { beforeEach, describe, expect, it } from 'vitest'
import { TicketService } from './ticket-service'
import { DomainError } from '../domain/errors'
import { CurrentUser, formatTicketRef, Reply, Ticket } from '../domain/ticket'
import { TicketFilter, TicketRepository, TicketUpdate } from '../repositories/ticket-repository'
import { ReplyRepository } from '../repositories/reply-repository'

class FakeTicketRepository implements TicketRepository {
  items: Ticket[] = []
  seq = 0

  async create(data: { title: string; description: string; customerId: string }) {
    this.seq++
    const now = new Date(2024, 0, 1, 0, 0, this.seq)
    const ticket: Ticket = {
      id: `ticket-${this.seq}`,
      title: data.title,
      description: data.description,
      status: 'open',
      category: null,
      priority: null,
      triageStatus: 'pending',
      customerId: data.customerId,
      assigneeId: null,
      createdAt: now,
      updatedAt: now,
    }
    this.items.push(ticket)
    return ticket
  }

  async findById(id: string) {
    return this.items.find((t) => t.id === id) || null
  }

  async findByIdWithDetails(id: string) {
    const ticket = await this.findById(id)
    return ticket ? { ...ticket, replies: [], attachments: [] } : null
  }

  async list(filter: TicketFilter, page: number, pageSize: number) {
    let items = this.items.filter(
      (t) => (!filter.customerId || t.customerId === filter.customerId) && (!filter.status || t.status === filter.status),
    )
    items = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length }
  }

  async update(id: string, data: TicketUpdate) {
    const ticket = this.items.find((t) => t.id === id)!
    Object.assign(ticket, data, { updatedAt: new Date() })
    return ticket
  }
}

class FakeReplyRepository implements ReplyRepository {
  items: Reply[] = []

  async create(data: { ticketId: string; authorId: string; body: string }) {
    const reply: Reply = {
      id: `reply-${this.items.length + 1}`,
      ...data,
      createdAt: new Date(),
      author: { id: data.authorId, name: 'Autor', role: 'customer' },
    }
    this.items.push(reply)
    return reply
  }
}

const customer: CurrentUser = { id: 'c1', role: 'customer' }
const otherCustomer: CurrentUser = { id: 'c2', role: 'customer' }
const agent: CurrentUser = { id: 'a1', role: 'agent' }
const otherAgent: CurrentUser = { id: 'a2', role: 'agent' }
const admin: CurrentUser = { id: 'adm', role: 'admin' }

// O status HTTP de cada código está coberto em src/http/errors.test.ts.
async function expectDomainError(promise: Promise<unknown>, code: string) {
  const err: unknown = await promise.catch((e) => e)
  expect(err).toBeInstanceOf(DomainError)
  expect((err as DomainError).code).toBe(code)
}

describe('TicketService', () => {
  let tickets: FakeTicketRepository
  let replies: FakeReplyRepository
  let service: TicketService

  beforeEach(() => {
    tickets = new FakeTicketRepository()
    replies = new FakeReplyRepository()
    service = new TicketService(tickets, replies)
  })

  const valid = { title: 'Problema no app', description: 'O aplicativo fecha sozinho ao abrir' }

  it('cria chamado aberto e pendente de triagem', async () => {
    const ticket = await service.create(customer, valid)
    expect(ticket.status).toBe('open')
    expect(ticket.triageStatus).toBe('pending')
    expect(ticket.category).toBeNull()
    expect(ticket.priority).toBeNull()
    expect(ticket.customerId).toBe('c1')
  })

  it('não deixa atendente abrir chamado', async () => {
    await expectDomainError(service.create(agent, valid), 'forbidden')
  })

  it('valida título e descrição', async () => {
    await expectDomainError(service.create(customer, { title: 'Oi', description: valid.description }), 'validation_error')
    await expectDomainError(service.create(customer, { title: valid.title, description: 'curta' }), 'validation_error')
  })

  it('cliente só lista os próprios chamados', async () => {
    await service.create(customer, valid)
    await service.create(otherCustomer, valid)
    const result = await service.list(customer, {})
    expect(result.total).toBe(1)
    expect(result.items[0].customerId).toBe('c1')
    const all = await service.list(agent, {})
    expect(all.total).toBe(2)
    expect(all.pageSize).toBe(20)
  })

  it('cliente recebe 404 no chamado de outro cliente', async () => {
    const ticket = await service.create(otherCustomer, valid)
    await expectDomainError(service.getById(customer, ticket.id), 'not_found')
  })

  it('atendente assume chamado aberto', async () => {
    const ticket = await service.create(customer, valid)
    const updated = await service.assign(agent, ticket.id)
    expect(updated.status).toBe('in_progress')
    expect(updated.assigneeId).toBe('a1')
  })

  it('não assume chamado resolvido', async () => {
    const ticket = await service.create(customer, valid)
    await service.assign(agent, ticket.id)
    await service.resolve(agent, ticket.id)
    await expectDomainError(service.assign(agent, ticket.id), 'invalid_transition')
  })

  it('cliente não assume chamado', async () => {
    const ticket = await service.create(customer, valid)
    await expectDomainError(service.assign(customer, ticket.id), 'forbidden')
  })

  it('só quem assumiu resolve', async () => {
    const ticket = await service.create(customer, valid)
    await service.assign(agent, ticket.id)
    await expectDomainError(service.resolve(otherAgent, ticket.id), 'forbidden')
    const resolved = await service.resolve(admin, ticket.id)
    expect(resolved.status).toBe('resolved')
  })

  it('não resolve chamado que não está em andamento', async () => {
    const ticket = await service.create(customer, valid)
    await expectDomainError(service.resolve(admin, ticket.id), 'invalid_transition')
  })

  it('resposta do cliente reabre chamado resolvido mantendo o responsável', async () => {
    const ticket = await service.create(customer, valid)
    await service.assign(agent, ticket.id)
    await service.resolve(agent, ticket.id)
    await service.addReply(customer, ticket.id, { body: 'Voltou a acontecer' })
    const reopened = await tickets.findById(ticket.id)
    expect(reopened!.status).toBe('open')
    expect(reopened!.assigneeId).toBe('a1')
  })

  it('resposta do atendente não reabre', async () => {
    const ticket = await service.create(customer, valid)
    await service.assign(agent, ticket.id)
    await service.resolve(agent, ticket.id)
    await service.addReply(agent, ticket.id, { body: 'Qualquer coisa, estamos aqui' })
    expect((await tickets.findById(ticket.id))!.status).toBe('resolved')
  })

  it('não aceita resposta vazia', async () => {
    const ticket = await service.create(customer, valid)
    await expectDomainError(service.addReply(customer, ticket.id, { body: '' }), 'validation_error')
    expect(replies.items).toHaveLength(0)
  })

  it('formata a referência do chamado', () => {
    expect(formatTicketRef({ id: 'abcdef123456', title: 'Teste' })).toBe('#abcdef12 (Teste)')
  })
})
