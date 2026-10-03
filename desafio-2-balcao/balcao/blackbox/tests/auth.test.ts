import { describe, expect, it } from 'vitest'
import { loginSeed, request, unique } from './helpers'

describe('autenticação', () => {
  it('cadastra cliente e não devolve o hash', async () => {
    const email = `${unique('novo')}@teste.dev`
    const res = await request('/api/auth/register', {
      method: 'POST',
      json: { name: 'Novo Cliente', email, password: '12345678' },
    })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ id: expect.any(String), name: 'Novo Cliente', email, role: 'customer' })
    expect(res.body.passwordHash).toBeUndefined()
  })

  it('recusa e-mail já cadastrado com 409', async () => {
    const email = `${unique('dup')}@teste.dev`
    await request('/api/auth/register', { method: 'POST', json: { name: 'A', email, password: '12345678' } })
    const res = await request('/api/auth/register', { method: 'POST', json: { name: 'B', email, password: '12345678' } })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('email_taken')
    expect(typeof res.body.message).toBe('string')
  })

  it('recusa senha curta com 422', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      json: { name: 'A', email: `${unique('curta')}@teste.dev`, password: '1234567' },
    })
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('validation_error')
  })

  it('faz login com as contas da seed', async () => {
    for (const [who, role] of [
      ['admin', 'admin'],
      ['agent', 'agent'],
      ['customer', 'customer'],
    ] as const) {
      const { token, user } = await loginSeed(who)
      expect(token).toEqual(expect.any(String))
      expect(user.role).toBe(role)
      expect(Object.keys(user).sort()).toEqual(['email', 'id', 'name', 'role'])
    }
  })

  it('recusa senha errada com 401', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      json: { email: 'cliente@balcao.dev', password: 'errada-123' },
    })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_credentials')
  })

  it('recusa e-mail inexistente com 401', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      json: { email: `${unique('nada')}@teste.dev`, password: '12345678' },
    })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_credentials')
  })

  it('GET /me devolve o usuário logado', async () => {
    const { token, user } = await loginSeed('agent')
    const res = await request('/api/auth/me', { token })
    expect(res.status).toBe(200)
    expect(res.body).toEqual(user)
  })

  it('GET /me sem token ou com token inválido responde 401', async () => {
    const noToken = await request('/api/auth/me')
    expect(noToken.status).toBe(401)
    expect(noToken.body.error).toBe('unauthorized')

    const badToken = await request('/api/auth/me', { token: 'nao-e-um-jwt' })
    expect(badToken.status).toBe(401)
    expect(badToken.body.error).toBe('unauthorized')
  })
})
