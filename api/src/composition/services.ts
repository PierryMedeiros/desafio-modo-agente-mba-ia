// Raiz de composição: o único lugar que liga services a repositórios, à IA e à configuração.
// Fica fora de http/ para que as rotas só conheçam services (G4).
import { env } from '../config/env'
import type { AppServices } from '../http/app'
import { suggestReply } from '../integrations/ai-client'
import { attachmentRepository } from '../repositories/attachment-repository'
import { healthRepository } from '../repositories/health-repository'
import { replyRepository } from '../repositories/reply-repository'
import { statsRepository } from '../repositories/stats-repository'
import { ticketRepository } from '../repositories/ticket-repository'
import { userRepository } from '../repositories/user-repository'
import { AttachmentService } from '../services/attachment-service'
import { AuthService } from '../services/auth-service'
import { HealthService } from '../services/health-service'
import { ReplySuggestionService } from '../services/reply-suggestion-service'
import { StatsService } from '../services/stats-service'
import { TicketService } from '../services/ticket-service'

export function buildServices(): AppServices {
  const ai = { mode: env.AI_MODE, apiKey: env.OPENAI_API_KEY }
  const tickets = new TicketService(ticketRepository, replyRepository)
  return {
    auth: new AuthService(userRepository),
    tickets,
    attachments: new AttachmentService(attachmentRepository, tickets, env.UPLOAD_DIR),
    suggestions: new ReplySuggestionService(tickets, userRepository, (input) => suggestReply(input, ai)),
    stats: new StatsService(statsRepository),
    health: new HealthService(healthRepository),
  }
}
