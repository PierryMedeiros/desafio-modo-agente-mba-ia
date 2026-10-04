// Worker de triagem: processo separado da API (npm run worker).
import { env } from '../config/env'
import { classifyTicket } from '../integrations/ai-client'
import { ticketRepository } from '../repositories/ticket-repository'

const interval = env.TRIAGE_INTERVAL_MS
const ai = { mode: env.AI_MODE, apiKey: env.OPENAI_API_KEY }

async function runOnce() {
  const tickets = await ticketRepository.findPendingTriage(10)

  for (const ticket of tickets) {
    try {
      const result = await classifyTicket(ticket, ai)
      await ticketRepository.update(ticket.id, { category: result.category, priority: result.priority, triageStatus: 'done' })
      console.log(`chamado ${ticket.id} triado: ${result.category}/${result.priority}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.log(`falha na triagem do chamado ${ticket.id}: ${message}`)
      await ticketRepository.update(ticket.id, { triageStatus: 'failed' })
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
