const SLA_HOURS: Record<string, number> = {
  urgent: 4,
  high: 8,
  medium: 24,
  low: 72,
}

export function slaHoursFor(priority: string | null) {
  return SLA_HOURS[priority || 'medium'] || 24
}

export function isBusinessDay(date: Date) {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

export function addBusinessHours(start: Date, hours: number) {
  const result = new Date(start)
  let remaining = hours
  while (remaining > 0) {
    result.setHours(result.getHours() + 1)
    if (isBusinessDay(result) && result.getHours() >= 9 && result.getHours() < 18) {
      remaining--
    }
  }
  return result
}

export function slaDeadline(createdAt: Date, priority: string | null) {
  return addBusinessHours(createdAt, slaHoursFor(priority))
}
