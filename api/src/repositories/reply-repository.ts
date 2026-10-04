import { prisma } from './prisma'
import { Reply } from '../domain/ticket'

export interface ReplyRepository {
  create(data: { ticketId: string; authorId: string; body: string }): Promise<Reply>
}

class PrismaReplyRepository implements ReplyRepository {
  create(data: { ticketId: string; authorId: string; body: string }) {
    return prisma.reply.create({
      data,
      include: { author: { select: { id: true, name: true, role: true } } },
    })
  }
}

export const replyRepository = new PrismaReplyRepository()
