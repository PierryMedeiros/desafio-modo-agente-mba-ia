import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET || 'dev-secret'

export function signToken(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: '8h' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token ausente' })
  }
  try {
    const payload: any = jwt.verify(header.slice(7), secret)
    ;(req as any).user = { id: payload.sub, role: payload.role }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token inválido' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Sem permissão' })
    }
    next()
  }
}
