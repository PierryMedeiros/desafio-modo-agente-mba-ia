import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { DomainError } from '../domain/errors'
import { User } from '../domain/user'
import { UserRepository } from '../repositories/user-repository'

export class EmailTakenError extends DomainError {
  constructor(message: string) {
    super('email_taken', message)
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor(message: string) {
    super('invalid_credentials', message)
  }
}

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres'),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
})

function serializeUser(user: Pick<User, 'id' | 'name' | 'email' | 'role'>) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export class AuthService {
  constructor(private users: UserRepository) {}

  async register(input: z.infer<typeof registerSchema>) {
    const existing = await this.users.findByEmail(input.email)
    if (existing) throw new EmailTakenError('E-mail já cadastrado')
    const passwordHash = await bcrypt.hash(input.password, 10)
    const user = await this.users.create({ name: input.name, email: input.email, passwordHash, role: 'customer' })
    return serializeUser(user)
  }

  async login(input: z.infer<typeof loginSchema>) {
    const user = await this.users.findByEmail(input.email)
    if (!user) throw new InvalidCredentialsError('E-mail ou senha inválidos')
    const ok = await bcrypt.compare(input.password, user.passwordHash)
    if (!ok) throw new InvalidCredentialsError('E-mail ou senha inválidos')
    return serializeUser(user)
  }

  /** Usuário logado (GET /me). Token válido de usuário que não existe mais vira unauthorized. */
  async me(userId: string) {
    const user = await this.users.findById(userId)
    if (!user) throw new DomainError('unauthorized', 'Usuário não encontrado')
    return serializeUser(user)
  }
}
