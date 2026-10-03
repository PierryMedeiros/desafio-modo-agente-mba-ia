import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { UserRepository } from '../repositories/user-repository'

export class EmailTakenError extends Error {}
export class InvalidCredentialsError extends Error {}

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres'),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
})

export function serializeUser(user: any) {
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
}
