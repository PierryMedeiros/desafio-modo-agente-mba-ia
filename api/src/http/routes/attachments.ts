import { Router } from 'express'
import { asyncHandler } from '../errors'
import { requireAuth } from '../middlewares/auth'
import { AttachmentService } from '../../services/attachment-service'
import { TicketService } from '../../services/ticket-service'
import { attachmentRepository } from '../../repositories/attachment-repository'
import { ticketRepository } from '../../repositories/ticket-repository'
import { replyRepository } from '../../repositories/reply-repository'

const router = Router()
const attachmentService = new AttachmentService(attachmentRepository, new TicketService(ticketRepository, replyRepository))

router.get(
  '/:id/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { attachment, filePath } = await attachmentService.getForDownload(req.user, req.params.id)
    const asciiName = attachment.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
    res.setHeader('Content-Type', attachment.mimeType)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    )
    res.sendFile(filePath)
  }),
)

export default router
