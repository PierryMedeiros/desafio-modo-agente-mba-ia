import { prisma } from '../../src/repositories/prisma'

export async function cleanDatabase() {
  await prisma.attachment.deleteMany()
  await prisma.reply.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.user.deleteMany()
}

export { prisma }
