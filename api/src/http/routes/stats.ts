import { Router } from 'express'
import { prisma } from '../../repositories/prisma'
import { requireAuth, requireRole } from '../middlewares/auth'

const router = Router()

router.get('/', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const [statusRows, categoryRows, priorityRows] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['category'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
    ])

    const byStatus: any = { open: 0, in_progress: 0, resolved: 0 }
    statusRows.forEach((row) => {
      byStatus[row.status] = row._count._all
    })

    const byCategory: any = { billing: 0, technical: 0, account: 0, other: 0, untriaged: 0 }
    categoryRows.forEach((row) => {
      byCategory[row.category || 'untriaged'] = row._count._all
    })

    const byPriority: any = { low: 0, medium: 0, high: 0, urgent: 0, untriaged: 0 }
    priorityRows.forEach((row) => {
      byPriority[row.priority || 'untriaged'] = row._count._all
    })

    res.json({ byStatus, byCategory, byPriority })
  } catch (err) {
    next(err)
  }
})

export default router
