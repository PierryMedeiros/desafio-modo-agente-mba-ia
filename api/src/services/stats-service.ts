import { StatsRepository } from '../repositories/stats-repository'

export class StatsService {
  constructor(private stats: StatsRepository) {}

  async summary() {
    const counts = await this.stats.countTickets()

    const byStatus: Record<string, number> = { open: 0, in_progress: 0, resolved: 0 }
    counts.byStatus.forEach((row) => {
      byStatus[row.key] = row.count
    })

    const byCategory: Record<string, number> = { billing: 0, technical: 0, account: 0, other: 0, untriaged: 0 }
    counts.byCategory.forEach((row) => {
      byCategory[row.key || 'untriaged'] = row.count
    })

    const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0, untriaged: 0 }
    counts.byPriority.forEach((row) => {
      byPriority[row.key || 'untriaged'] = row.count
    })

    return { byStatus, byCategory, byPriority }
  }
}
