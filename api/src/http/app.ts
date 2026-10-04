import express from 'express'
import cors from 'cors'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { ticketRoutes } from './routes/tickets'
import { attachmentRoutes } from './routes/attachments'
import { statsRoutes } from './routes/stats'
import { errorHandler, notFoundHandler } from './errors'
import { AuthService } from '../services/auth-service'
import { TicketService } from '../services/ticket-service'
import { AttachmentService } from '../services/attachment-service'
import { ReplySuggestionService } from '../services/reply-suggestion-service'
import { StatsService } from '../services/stats-service'
import { HealthService } from '../services/health-service'

/** Services que as rotas usam; quem monta é a raiz de composição (api/src/composition/). */
export type AppServices = {
  auth: AuthService
  tickets: TicketService
  attachments: AttachmentService
  suggestions: ReplySuggestionService
  stats: StatsService
  health: HealthService
}

export function createApp(services: AppServices, options: { corsOrigin: string }) {
  const app = express()

  app.use(cors({ origin: options.corsOrigin }))
  app.use(express.json())

  app.use('/api/health', healthRoutes(services.health))
  app.use('/api/auth', authRoutes(services.auth))
  app.use('/api/tickets', ticketRoutes(services.tickets, services.attachments, services.suggestions))
  app.use('/api/attachments', attachmentRoutes(services.attachments))
  app.use('/api/stats', statsRoutes(services.stats))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
