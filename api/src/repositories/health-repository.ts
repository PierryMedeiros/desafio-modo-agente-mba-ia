import { prisma } from './prisma'

export interface HealthRepository {
  pingDatabase(): Promise<void>
}

class PrismaHealthRepository implements HealthRepository {
  async pingDatabase() {
    await prisma.$queryRaw`SELECT 1`
  }
}

export const healthRepository = new PrismaHealthRepository()
