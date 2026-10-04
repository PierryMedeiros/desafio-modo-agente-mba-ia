import { Router } from 'express'
import { asyncHandler } from '../errors'
import { requireAuth, requireRole } from '../middlewares/auth'
import { StatsService } from '../../services/stats-service'

export function statsRoutes(statsService: StatsService) {
  const router = Router()

  router.get(
    '/',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (_req, res) => {
      res.json(await statsService.summary())
    }),
  )

  return router
}
