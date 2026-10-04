import { Router } from 'express'
import { HealthService } from '../../services/health-service'

export function healthRoutes(healthService: HealthService) {
  const router = Router()

  router.get('/', async (_req, res) => {
    try {
      await healthService.checkDatabase()
      res.json({ status: 'ok', db: 'ok' })
    } catch (err) {
      console.log('health: banco fora', err)
      res.status(503).json({ error: 'db_unavailable', message: 'Banco de dados não responde' })
    }
  })

  return router
}
