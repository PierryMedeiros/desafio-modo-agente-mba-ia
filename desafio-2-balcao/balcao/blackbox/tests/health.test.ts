import { describe, expect, it } from 'vitest'
import { request } from './helpers'

describe('GET /api/health', () => {
  it('responde ok com o banco no ar', async () => {
    const res = await request('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', db: 'ok' })
  })
})
