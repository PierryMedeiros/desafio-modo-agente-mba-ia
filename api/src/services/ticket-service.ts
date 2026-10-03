import { z } from 'zod'
import { HttpError } from '../http/errors'
import { CurrentUser, Ticket, TICKET_STATUSES, TicketStatus } from '../domain/ticket'
import { TicketRepository } from '../repositories/ticket-repository'
import { notifyAssignee } from './notification-service'

export const PAGE_SIZE = 20

const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'Título deve ter entre 3 e 120 caracteres').max(120, 'Título deve ter entre 3 e 120 caracteres'),
  description: z
    .string()
    .trim()
    .min(10, 'Descrição deve ter entre 10 e 5000 caracteres')
    .max(5000, 'Descrição deve ter entre 10 e 5000 caracteres'),
})

export function formatTicketRef(ticket: { id: string; title: string }) {
  return `#${ticket.id.slice(0, 8)} (${ticket.title})`
}

export class TicketService {
  constructor(private tickets: TicketRepository) {}

  async create(user: CurrentUser, input: unknown) {
    if (user.role !== 'customer') {
      throw new HttpError(403, 'forbidden', 'Só clientes podem abrir chamados')
    }
    const parsed = createTicketSchema.safeParse(input)
    if (!parsed.success) {
      throw new HttpError(422, 'validation_error', parsed.error.issues[0].message)
    }
    return this.tickets.create({ ...parsed.data, customerId: user.id })
  }

  async list(user: CurrentUser, query: { status?: string; page?: string }) {
    let status: TicketStatus | undefined
    if (query.status) {
      if (!TICKET_STATUSES.includes(query.status as TicketStatus)) {
        throw new HttpError(422, 'validation_error', 'Status inválido')
      }
      status = query.status as TicketStatus
    }
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const filter = user.role === 'customer' ? { customerId: user.id, status } : { status }
    const { items, total } = await this.tickets.list(filter, page, PAGE_SIZE)
    return { items, page, pageSize: PAGE_SIZE, total }
  }

  async getById(user: CurrentUser, id: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(id)
    if (!ticket || (user.role === 'customer' && ticket.customerId !== user.id)) {
      throw new HttpError(404, 'not_found', 'Chamado não encontrado')
    }
    return ticket
  }

  async getDetails(user: CurrentUser, id: string) {
    await this.getById(user, id)
    return this.tickets.findByIdWithDetails(id)
  }

  async assign(user: CurrentUser, id: string) {
    if (user.role === 'customer') {
      throw new HttpError(403, 'forbidden', 'Só atendentes e admins assumem chamados')
    }
    const ticket = await this.getById(user, id)
    if (ticket.status === 'resolved') {
      throw new HttpError(409, 'invalid_transition', 'Chamado resolvido não pode ser assumido')
    }
    const updated = await this.tickets.update(id, { status: 'in_progress', assigneeId: user.id })
    notifyAssignee(updated, user.id)
    return updated
  }

  async resolve(user: CurrentUser, id: string) {
    if (user.role === 'customer') {
      throw new HttpError(403, 'forbidden', 'Só atendentes e admins resolvem chamados')
    }
    const ticket = await this.getById(user, id)
    if (user.role !== 'admin' && ticket.assigneeId !== user.id) {
      throw new HttpError(403, 'forbidden', 'Só quem assumiu o chamado pode resolver')
    }
    if (ticket.status !== 'in_progress') {
      throw new HttpError(409, 'invalid_transition', 'Só chamado em andamento pode ser resolvido')
    }
    return this.tickets.update(id, { status: 'resolved' })
  }
}
