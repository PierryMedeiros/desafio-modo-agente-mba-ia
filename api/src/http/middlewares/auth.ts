import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'
import { CurrentUser, Role } from '../../domain/ticket'
import { HttpError } from '../errors'

const ROLES: Role[] = ['customer', 'agent', 'admin']

// Usuário autenticado de cada requisição, preenchido por requireAuth.
const authenticated = new WeakMap<Request, CurrentUser>()

export function signToken(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '8h' })
}

function userFromToken(token: string): CurrentUser | null {
  const payload = jwt.verify(token, env.JWT_SECRET)
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !ROLES.includes(payload.role)) {
    return null
  }
  return { id: payload.sub, role: payload.role }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token ausente' })
  }
  let user: CurrentUser | null
  try {
    user = userFromToken(header.slice(7))
  } catch {
    user = null
  }
  if (!user) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token inválido' })
  }
  authenticated.set(req, user)
  next()
}

/** Usuário logado; só use em rotas protegidas por requireAuth. */
export function currentUser(req: Request): CurrentUser {
  const user = authenticated.get(req)
  if (!user) throw new HttpError(401, 'unauthorized', 'Token ausente')
  return user
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = authenticated.get(req)
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Sem permissão' })
    }
    next()
  }
}
