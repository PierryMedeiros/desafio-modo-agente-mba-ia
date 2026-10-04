import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { DomainError } from '../domain/errors'
import { CurrentUser } from '../domain/ticket'
import { AttachmentRepository } from '../repositories/attachment-repository'
import { TicketService } from './ticket-service'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain']

/** Arquivo recebido pelo transporte (a camada http converte o do multer para este formato). */
export type UploadedFile = {
  originalName: string
  mimeType: string
  size: number
  buffer: Buffer
}

export class AttachmentService {
  constructor(
    private attachments: AttachmentRepository,
    private tickets: TicketService,
    private uploadDir: string,
  ) {}

  async upload(user: CurrentUser, ticketId: string, file: UploadedFile | undefined) {
    await this.tickets.getById(user, ticketId)

    if (!file) {
      throw new DomainError('validation_error', 'Envie o arquivo no campo file')
    }
    if (file.size > MAX_SIZE) {
      throw new DomainError('file_too_large', 'O arquivo pode ter no máximo 5 MB')
    }
    if (!ALLOWED_TYPES.includes(file.mimeType)) {
      throw new DomainError('unsupported_type', 'Tipo de arquivo não suportado')
    }

    fs.mkdirSync(this.uploadDir, { recursive: true })
    const storedName = crypto.randomUUID() + path.extname(file.originalName)
    fs.writeFileSync(path.join(this.uploadDir, storedName), file.buffer)

    return this.attachments.create({
      ticketId,
      uploaderId: user.id,
      originalName: file.originalName,
      storedName,
      mimeType: file.mimeType,
      sizeBytes: file.size,
    })
  }

  async getForDownload(user: CurrentUser, attachmentId: string) {
    const attachment = await this.attachments.findById(attachmentId)
    if (!attachment) {
      throw new DomainError('not_found', 'Anexo não encontrado')
    }
    try {
      await this.tickets.getById(user, attachment.ticketId)
    } catch {
      throw new DomainError('not_found', 'Anexo não encontrado')
    }
    return { attachment, filePath: path.join(this.uploadDir, attachment.storedName) }
  }
}
