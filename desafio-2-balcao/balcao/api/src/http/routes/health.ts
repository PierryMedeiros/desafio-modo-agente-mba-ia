import { Router } from 'express'
import { prisma } from '../../repositories/prisma'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'ok' })
  } catch (err) {
    console.log('health: banco fora', err)
    res.status(503).json({ error: 'db_unavailable', message: 'Banco de dados não responde' })
  }
})

export default router
