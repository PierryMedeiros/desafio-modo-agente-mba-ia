import { z } from 'zod'
import { DomainError } from '../domain/errors'
import { CurrentUser, Ticket, TicketDetails, TICKET_STATUSES, TicketStatus } from '../domain/ticket'
import { TicketRepository } from '../repositories/ticket-repository'
import { ReplyRepository } from '../repositories/reply-repository'
import { notifyAssignee } from './notification-service'

const PAGE_SIZE = 20

const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'Título deve ter entre 3 e 120 caracteres').max(120, 'Título deve ter entre 3 e 120 caracteres'),
  description: z
    .string()
    .trim()
    .min(10, 'Descrição deve ter entre 10 e 5000 caracteres')
    .max(5000, 'Descrição deve ter entre 10 e 5000 caracteres'),
})

const replySchema = z.object({
  body: z.string().trim().min(1, 'A resposta não pode ser vazia').max(5000, 'A resposta pode ter no máximo 5000 caracteres'),
})

function isTicketStatus(value: unknown): value is TicketStatus {
  return TICKET_STATUSES.includes(value as TicketStatus)
}

export class TicketService {
  constructor(
    private tickets: TicketRepository,
    private replies: ReplyRepository,
  ) {}

  async create(user: CurrentUser, input: unknown) {
    if (user.role !== 'customer') {
      throw new DomainError('forbidden', 'Só clientes podem abrir chamados')
    }
    const parsed = createTicketSchema.safeParse(input)
    if (!parsed.success) {
      throw new DomainError('validation_error', parsed.error.issues[0].message)
    }
    return this.tickets.create({ ...parsed.data, customerId: user.id })
  }

  async list(user: CurrentUser, query: { status?: unknown; page?: unknown }) {
    let status: TicketStatus | undefined
    if (query.status) {
      if (!isTicketStatus(query.status)) {
        throw new DomainError('validation_error', 'Status inválido')
      }
      status = query.status
    }
    const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1)
    const filter = user.role === 'customer' ? { customerId: user.id, status } : { status }
    const { items, total } = await this.tickets.list(filter, page, PAGE_SIZE)
    return { items, page, pageSize: PAGE_SIZE, total }
  }

  async getById(user: CurrentUser, id: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(id)
    if (!ticket || (user.role === 'customer' && ticket.customerId !== user.id)) {
      throw new DomainError('not_found', 'Chamado não encontrado')
    }
    return ticket
  }

  async getDetails(user: CurrentUser, id: string): Promise<TicketDetails> {
    await this.getById(user, id)
    const details = await this.tickets.findByIdWithDetails(id)
    if (!details) {
      throw new DomainError('not_found', 'Chamado não encontrado')
    }
    return details
  }

  async assign(user: CurrentUser, id: string) {
    if (user.role === 'customer') {
      throw new DomainError('forbidden', 'Só atendentes e admins assumem chamados')
    }
    const ticket = await this.getById(user, id)
    if (ticket.status === 'resolved') {
      throw new DomainError('invalid_transition', 'Chamado resolvido não pode ser assumido')
    }
    const updated = await this.tickets.update(id, { status: 'in_progress', assigneeId: user.id })
    notifyAssignee(updated, user.id)
    return updated
  }

  async resolve(user: CurrentUser, id: string) {
    if (user.role === 'customer') {
      throw new DomainError('forbidden', 'Só atendentes e admins resolvem chamados')
    }
    const ticket = await this.getById(user, id)
    if (user.role !== 'admin' && ticket.assigneeId !== user.id) {
      throw new DomainError('forbidden', 'Só quem assumiu o chamado pode resolver')
    }
    if (ticket.status !== 'in_progress') {
      throw new DomainError('invalid_transition', 'Só chamado em andamento pode ser resolvido')
    }
    return this.tickets.update(id, { status: 'resolved' })
  }

  async addReply(user: CurrentUser, id: string, input: unknown) {
    const ticket = await this.getById(user, id)
    const parsed = replySchema.safeParse(input)
    if (!parsed.success) {
      throw new DomainError('validation_error', parsed.error.issues[0].message)
    }
    const reply = await this.replies.create({ ticketId: id, authorId: user.id, body: parsed.data.body })
    if (user.role === 'customer' && ticket.status === 'resolved') {
      await this.tickets.update(id, { status: 'open' })
    }
    return reply
  }
}
