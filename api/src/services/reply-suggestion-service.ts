import { DomainError } from '../domain/errors'
import { CurrentUser } from '../domain/ticket'
import { UserRepository } from '../repositories/user-repository'
import { TicketService } from './ticket-service'

/** Gera o texto da sugestão (fake ou OpenAI); vem de integrations/ pela raiz de composição. */
type SuggestReply = (input: { customerName: string; title: string; description: string }) => Promise<string | null>

export class ReplySuggestionService {
  constructor(
    private tickets: Pick<TicketService, 'getById'>,
    private users: Pick<UserRepository, 'findById'>,
    private suggestReply: SuggestReply,
  ) {}

  async suggest(user: CurrentUser, ticketId: string) {
    if (user.role === 'customer') {
      throw new DomainError('forbidden', 'Só atendentes e admins podem pedir sugestão')
    }
    const ticket = await this.tickets.getById(user, ticketId)
    const customer = await this.users.findById(ticket.customerId)
    const customerName = customer ? customer.name : 'cliente'
    return this.suggestReply({ customerName, title: ticket.title, description: ticket.description })
  }
}
