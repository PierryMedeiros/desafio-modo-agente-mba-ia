import { HealthRepository } from '../repositories/health-repository'

export class HealthService {
  constructor(private health: HealthRepository) {}

  /** Lança o erro do banco quando ele não responde; a camada http decide o status. */
  checkDatabase() {
    return this.health.pingDatabase()
  }
}
