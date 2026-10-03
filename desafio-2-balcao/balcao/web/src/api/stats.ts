import { apiFetch } from './client'

export type Stats = {
  byStatus: Record<string, number>
  byCategory: Record<string, number>
  byPriority: Record<string, number>
}

export function getStats() {
  return apiFetch<Stats>('/stats')
}
