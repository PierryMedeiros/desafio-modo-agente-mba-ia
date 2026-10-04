import { Role } from './ticket'

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string
  role: Role
  createdAt: Date
}
