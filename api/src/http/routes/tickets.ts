import { Router } from 'express'
import multer from 'multer'
import OpenAI from 'openai'
import { asyncHandler, HttpError } from '../errors'
import { requireAuth } from '../middlewares/auth'
import { TicketService } from '../../services/ticket-service'
import { ticketRepository } from '../../repositories/ticket-repository'
import { replyRepository } from '../../repositories/reply-repository'
import { attachmentRepository } from '../../repositories/attachment-repository'
import { AttachmentService } from '../../services/attachment-service'
import { userRepository } from '../../repositories/user-repository'

const router = Router()
const ticketService = new TicketService(ticketRepository, replyRepository)
const attachmentService = new AttachmentService(attachmentRepository, ticketService)
const upload = multer({ storage: multer.memoryStorage() })

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

function toReplyJson(r: any) {
  return {
    id: r.id,
    ticketId: r.ticketId,
    authorId: r.authorId,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: r.author,
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

router.post(
  '/:id/replies',
  asyncHandler(async (req, res) => {
    const reply = await ticketService.addReply(req.user, req.params.id, req.body)
    res.status(201).json(toReplyJson(reply))
  }),
)

router.post(
  '/:id/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const attachment = await attachmentService.upload(req, req.params.id)
    res.status(201).json(attachment)
  }),
)

router.post(
  '/:id/suggest-reply',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'customer') {
      throw new HttpError(403, 'forbidden', 'Só atendentes e admins podem pedir sugestão')
    }
    const ticket = await ticketService.getById(req.user, req.params.id)
    const customer = await userRepository.findById(ticket.customerId)
    const customerName = customer ? customer.name : 'cliente'

    if (process.env.AI_MODE === 'openai') {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um atendente de suporte. Escreva uma resposta curta e educada, em português, para o chamado.',
          },
          { role: 'user', content: `Cliente: ${customerName}\nTítulo: ${ticket.title}\n\n${ticket.description}` },
        ],
      })
      return res.json({ suggestion: completion.choices[0].message.content })
    }

    res.json({
      suggestion: `Olá, ${customerName}! Recebemos o seu chamado "${ticket.title}" e a nossa equipe já está analisando.`,
    })
  }),
)

export default router
