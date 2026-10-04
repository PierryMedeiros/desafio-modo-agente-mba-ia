import { prisma } from './prisma'
import { Role } from '../domain/ticket'
import { User } from '../domain/user'

export type NewUser = {
  name: string
  email: string
  passwordHash: string
  role?: Role
}

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(data: NewUser): Promise<User>
}

class PrismaUserRepository implements UserRepository {
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
