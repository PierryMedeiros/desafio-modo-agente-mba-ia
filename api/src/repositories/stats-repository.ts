import { prisma } from './prisma'
import { TicketCategory, TicketPriority, TicketStatus } from '../domain/ticket'

type GroupCount<K> = { key: K; count: number }

type TicketCounts = {
  byStatus: GroupCount<TicketStatus>[]
  byCategory: GroupCount<TicketCategory | null>[]
  byPriority: GroupCount<TicketPriority | null>[]
}

export interface StatsRepository {
  countTickets(): Promise<TicketCounts>
}

class PrismaStatsRepository implements StatsRepository {
  async countTickets(): Promise<TicketCounts> {
    const [statusRows, categoryRows, priorityRows] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['category'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
    ])
    return {
      byStatus: statusRows.map((row) => ({ key: row.status, count: row._count._all })),
      byCategory: categoryRows.map((row) => ({ key: row.category, count: row._count._all })),
      byPriority: priorityRows.map((row) => ({ key: row.priority, count: row._count._all })),
    }
  }
}

export const statsRepository = new PrismaStatsRepository()
