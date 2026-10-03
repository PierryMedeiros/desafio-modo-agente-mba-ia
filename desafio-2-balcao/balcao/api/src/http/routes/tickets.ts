import { Router } from 'express'
import { asyncHandler } from '../errors'
import { requireAuth } from '../middlewares/auth'
import { TicketService } from '../../services/ticket-service'
import { ticketRepository } from '../../repositories/ticket-repository'

const router = Router()
const ticketService = new TicketService(ticketRepository)

export function toTicketJson(t: any) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    category: t.category,
    priority: t.priority,
    triageStatus: t.triageStatus,
    customerId: t.customerId,
    assigneeId: t.assigneeId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

router.use(requireAuth)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await ticketService.list(req.user, req.query)
    res.json({ ...result, items: result.items.map(toTicketJson) })
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.create(req.user, req.body)
    res.status(201).json(toTicketJson(ticket))
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.getDetails(req.user, req.params.id)
    res.json(toTicketJson(ticket))
  }),
)

router.post(
  '/:id/assign',
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.assign(req.user, req.params.id)
    res.json(toTicketJson(ticket))
  }),
)

router.post(
  '/:id/resolve',
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.resolve(req.user, req.params.id)
    res.json(toTicketJson(ticket))
  }),
)

export default router
