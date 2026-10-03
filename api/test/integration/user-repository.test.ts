import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanDatabase, prisma } from './helpers'
import { userRepository } from '../../src/repositories/user-repository'

describe('PrismaUserRepository', () => {
  beforeAll(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('cria e busca por e-mail e id', async () => {
    const user = await userRepository.create({ name: 'Maria', email: 'maria@teste.dev', passwordHash: 'hash' })
    expect(user.role).toBe('customer')

    const byEmail = await userRepository.findByEmail('maria@teste.dev')
    expect(byEmail?.id).toBe(user.id)

    const byId = await userRepository.findById(user.id)
    expect(byId?.email).toBe('maria@teste.dev')
  })

  it('retorna null quando não existe', async () => {
    expect(await userRepository.findByEmail('ninguem@teste.dev')).toBeNull()
    expect(await userRepository.findById('nao-existe')).toBeNull()
  })

  it('não deixa repetir e-mail', async () => {
    await expect(
      userRepository.create({ name: 'Outra', email: 'maria@teste.dev', passwordHash: 'hash' }),
    ).rejects.toThrow()
  })
})
