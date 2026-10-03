import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { Request } from 'express'
import { HttpError } from '../http/errors'
import { CurrentUser } from '../domain/ticket'
import { AttachmentRepository } from '../repositories/attachment-repository'
import { TicketService } from './ticket-service'

const uploadDir = process.env.UPLOAD_DIR || '/tmp/balcao/uploads'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain']

export class AttachmentService {
  constructor(
    private attachments: AttachmentRepository,
    private tickets: TicketService,
  ) {}

  async upload(req: Request, ticketId: string) {
    const user: CurrentUser = (req as any).user
    await this.tickets.getById(user, ticketId)

    const file = req.file
    if (!file) {
      throw new HttpError(422, 'validation_error', 'Envie o arquivo no campo file')
    }
    if (file.size > MAX_SIZE) {
      throw new HttpError(413, 'file_too_large', 'O arquivo pode ter no máximo 5 MB')
    }
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new HttpError(415, 'unsupported_type', 'Tipo de arquivo não suportado')
    }

    fs.mkdirSync(uploadDir, { recursive: true })
    const storedName = crypto.randomUUID() + path.extname(file.originalname)
    fs.writeFileSync(path.join(uploadDir, storedName), file.buffer)

    return this.attachments.create({
      ticketId,
      uploaderId: user.id,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    })
  }

  async getForDownload(user: CurrentUser, attachmentId: string) {
    const attachment = await this.attachments.findById(attachmentId)
    if (!attachment) {
      throw new HttpError(404, 'not_found', 'Anexo não encontrado')
    }
    try {
      await this.tickets.getById(user, attachment.ticketId)
    } catch (err) {
      throw new HttpError(404, 'not_found', 'Anexo não encontrado')
    }
    return { attachment, filePath: path.join(uploadDir, attachment.storedName) }
  }
}
