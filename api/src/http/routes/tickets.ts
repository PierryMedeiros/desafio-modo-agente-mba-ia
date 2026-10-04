import { Router } from 'express'
import multer from 'multer'
import { asyncHandler } from '../errors'
import { currentUser, requireAuth } from '../middlewares/auth'
import { Reply, Ticket } from '../../domain/ticket'
import { TicketService } from '../../services/ticket-service'
import { AttachmentService } from '../../services/attachment-service'
import { ReplySuggestionService } from '../../services/reply-suggestion-service'

function toTicketJson(t: Ticket) {
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

function toReplyJson(r: Reply) {
  return {
    id: r.id,
    ticketId: r.ticketId,
    authorId: r.authorId,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: r.author,
  }
}

export function ticketRoutes(
  ticketService: TicketService,
  attachmentService: AttachmentService,
  suggestionService: ReplySuggestionService,
) {
  const router = Router()
  const upload = multer({ storage: multer.memoryStorage() })

  router.use(requireAuth)

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const result = await ticketService.list(currentUser(req), req.query)
      res.json({ ...result, items: result.items.map(toTicketJson) })
    }),
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const ticket = await ticketService.create(currentUser(req), req.body)
      res.status(201).json(toTicketJson(ticket))
    }),
  )

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const ticket = await ticketService.getDetails(currentUser(req), req.params.id)
      res.json({
        ...toTicketJson(ticket),
        replies: ticket.replies.map(toReplyJson),
        attachments: ticket.attachments,
      })
    }),
  )

  router.post(
    '/:id/assign',
    asyncHandler(async (req, res) => {
      const ticket = await ticketService.assign(currentUser(req), req.params.id)
      res.json(toTicketJson(ticket))
    }),
  )

  router.post(
    '/:id/resolve',
    asyncHandler(async (req, res) => {
      const ticket = await ticketService.resolve(currentUser(req), req.params.id)
      res.json(toTicketJson(ticket))
    }),
  )

  router.post(
    '/:id/replies',
    asyncHandler(async (req, res) => {
      const reply = await ticketService.addReply(currentUser(req), req.params.id, req.body)
      res.status(201).json(toReplyJson(reply))
    }),
  )

  router.post(
    '/:id/attachments',
    upload.single('file'),
    asyncHandler(async (req, res) => {
      const file = req.file && {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer,
      }
      const attachment = await attachmentService.upload(currentUser(req), req.params.id, file)
      res.status(201).json(attachment)
    }),
  )

  router.post(
    '/:id/suggest-reply',
    asyncHandler(async (req, res) => {
      const suggestion = await suggestionService.suggest(currentUser(req), req.params.id)
      res.json({ suggestion })
    }),
  )

  return router
}
