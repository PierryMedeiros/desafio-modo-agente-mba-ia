import { prisma } from './prisma'
import { Attachment } from '../domain/ticket'

type NewAttachment = Omit<Attachment, 'id' | 'createdAt'>

export interface AttachmentRepository {
  create(data: NewAttachment): Promise<Attachment>
  findById(id: string): Promise<Attachment | null>
}

class PrismaAttachmentRepository implements AttachmentRepository {
  create(data: NewAttachment) {
    return prisma.attachment.create({ data })
  }

  findById(id: string) {
    return prisma.attachment.findUnique({ where: { id } })
  }
}

export const attachmentRepository = new PrismaAttachmentRepository()
