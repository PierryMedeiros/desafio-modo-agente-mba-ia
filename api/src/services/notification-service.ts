import { formatTicketRef } from '../domain/ticket'

export function notifyAssignee(ticket: { id: string; title: string }, assigneeId: string) {
  console.log(`[notificacao] chamado ${formatTicketRef(ticket)} atribuido para ${assigneeId}`)
}
