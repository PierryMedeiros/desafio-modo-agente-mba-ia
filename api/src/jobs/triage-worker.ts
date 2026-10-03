import { PrismaClient } from '@prisma/client'
import { classifyTicket } from '../integrations/ai-client'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

const interval = Number(process.env.TRIAGE_INTERVAL_MS || 2000)

async function runOnce() {
  const tickets = await prisma.ticket.findMany({
    where: { triageStatus: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 10,
  })

  for (const ticket of tickets) {
    try {
      const result = await classifyTicket(ticket)
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { category: result.category, priority: result.priority, triageStatus: 'done' },
      })
      console.log(`chamado ${ticket.id} triado: ${result.category}/${result.priority}`)
    } catch (err: any) {
      console.log(`falha na triagem do chamado ${ticket.id}: ${err.message}`)
      await prisma.ticket.update({ where: { id: ticket.id }, data: { triageStatus: 'failed' } })
    }
  }
}

async function loop() {
  try {
    await runOnce()
  } catch (err) {
    console.log('erro no worker', err)
  }
  setTimeout(loop, interval)
}

console.log(`worker de triagem rodando a cada ${interval}ms`)
loop()
