import { Attachment } from '@prisma/client'
import { prisma } from './prisma'

export type NewAttachment = {
  ticketId: string
  uploaderId: string
  originalName: string
  storedName: string
  mimeType: string
  sizeBytes: number
}

export interface AttachmentRepository {
  create(data: NewAttachment): Promise<Attachment>
  findById(id: string): Promise<Attachment | null>
}

export class PrismaAttachmentRepository implements AttachmentRepository {
  create(data: NewAttachment) {
    return prisma.attachment.create({ data })
  }

  findById(id: string) {
    return prisma.attachment.findUnique({ where: { id } })
  }
}

export const attachmentRepository = new PrismaAttachmentRepository()
