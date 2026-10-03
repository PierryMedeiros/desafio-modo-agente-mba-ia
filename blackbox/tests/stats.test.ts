import { describe, expect, it } from 'vitest'
import { createTicket, loginSeed, newCustomer, request, unique, waitForTriage } from './helpers'

function sum(values: Record<string, number>) {
  return Object.values(values).reduce((a, b) => a + b, 0)
}

describe('estatísticas', () => {
  it('só admin acessa', async () => {
    expect((await request('/api/stats')).status).toBe(401)
    for (const who of ['agent', 'customer'] as const) {
      const { token } = await loginSeed(who)
      const res = await request('/api/stats', { token })
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('forbidden')
    }
  })

  it('tem o formato esperado e os totais batem', async () => {
    const { token } = await loginSeed('admin')
    const res = await request('/api/stats', { token })
    expect(res.status).toBe(200)
    expect(Object.keys(res.body.byStatus).sort()).toEqual(['in_progress', 'open', 'resolved'])
    expect(Object.keys(res.body.byCategory).sort()).toEqual(['account', 'billing', 'other', 'technical', 'untriaged'])
    expect(Object.keys(res.body.byPriority).sort()).toEqual(['high', 'low', 'medium', 'untriaged', 'urgent'])
    const total = sum(res.body.byStatus)
    expect(sum(res.body.byCategory)).toBe(total)
    expect(sum(res.body.byPriority)).toBe(total)
  })

  it('reflete chamados criados, triados e resolvidos', async () => {
    const admin = await loginSeed('admin')
    const agent = await loginSeed('agent')
    const customer = await newCustomer()

    const before = (await request('/api/stats', { token: admin.token })).body

    const billing = await createTicket(customer.token, `Boleto vencido ${unique('')}`, 'Meu boleto venceu ontem, como pago?')
    const failing = await createTicket(customer.token, `Erro [falha-ia] ${unique('')}`, 'Descrição qualquer do chamado')
    await waitForTriage(customer.token, billing.id)
    await waitForTriage(customer.token, failing.id)
    await request(`/api/tickets/${billing.id}/assign`, { method: 'POST', token: agent.token })
    await request(`/api/tickets/${billing.id}/resolve`, { method: 'POST', token: agent.token })

    const after = (await request('/api/stats', { token: admin.token })).body

    expect(after.byStatus.open - before.byStatus.open).toBe(1)
    expect(after.byStatus.in_progress - before.byStatus.in_progress).toBe(0)
    expect(after.byStatus.resolved - before.byStatus.resolved).toBe(1)
    expect(sum(after.byCategory) - sum(before.byCategory)).toBe(2)
    expect(sum(after.byPriority) - sum(before.byPriority)).toBe(2)
    expect(after.byCategory.billing - before.byCategory.billing).toBeGreaterThanOrEqual(1)
    expect(after.byPriority.untriaged).toBeGreaterThanOrEqual(1)
    expect(after.byCategory.untriaged).toBeGreaterThanOrEqual(1)
  }, 40000)
})
