import { User } from '@prisma/client'
import { prisma } from './prisma'

export type NewUser = {
  name: string
  email: string
  passwordHash: string
  role?: 'customer' | 'agent' | 'admin'
}

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(data: NewUser): Promise<User>
}

export class PrismaUserRepository implements UserRepository {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  }

  create(data: NewUser) {
    return prisma.user.create({ data })
  }
}

export const userRepository = new PrismaUserRepository()
