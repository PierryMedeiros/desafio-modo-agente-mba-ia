export type Role = 'customer' | 'agent' | 'admin'

export type TicketStatus = 'open' | 'in_progress' | 'resolved'

export type TicketCategory = 'billing' | 'technical' | 'account' | 'other'

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TriageStatus = 'pending' | 'done' | 'failed'

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved']
export const TICKET_CATEGORIES: TicketCategory[] = ['billing', 'technical', 'account', 'other']
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']

export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  category: TicketCategory | null
  priority: TicketPriority | null
  triageStatus: TriageStatus
  customerId: string
  assigneeId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CurrentUser {
  id: string
  role: Role
}

interface ReplyAuthor {
  id: string
  name: string
  role: Role
}

export interface Reply {
  id: string
  ticketId: string
  authorId: string
  body: string
  createdAt: Date
  author: ReplyAuthor
}

export interface Attachment {
  id: string
  ticketId: string
  uploaderId: string
  originalName: string
  storedName: string
  mimeType: string
  sizeBytes: number
  createdAt: Date
}

export interface TicketDetails extends Ticket {
  replies: Reply[]
  attachments: Attachment[]
}

export function formatTicketRef(ticket: { id: string; title: string }) {
  return `#${ticket.id.slice(0, 8)} (${ticket.title})`
}
