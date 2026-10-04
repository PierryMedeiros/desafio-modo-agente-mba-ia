import { NextFunction, Request, Response } from 'express'
import { DomainError, DomainErrorCode } from '../domain/errors'

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

/** Status HTTP de cada erro de negócio. O corpo continua {"error": code, "message": message}. */
const STATUS_BY_DOMAIN_CODE: Record<DomainErrorCode, number> = {
  validation_error: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_transition: 409,
  email_taken: 409,
  invalid_credentials: 401,
  file_too_large: 413,
  unsupported_type: 415,
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'not_found', message: 'Rota não encontrada' })
}

function hasType(err: unknown, type: string) {
  return typeof err === 'object' && err !== null && 'type' in err && err.type === type
}

// O Express só trata como handler de erro a função com 4 parâmetros, por isso o next fica.
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err)
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message })
  }
  if (err instanceof DomainError) {
    return res.status(STATUS_BY_DOMAIN_CODE[err.code]).json({ error: err.code, message: err.message })
  }
  if (err instanceof Error && err.name === 'MulterError') {
    return res.status(422).json({ error: 'validation_error', message: err.message })
  }
  if (hasType(err, 'entity.parse.failed')) {
    return res.status(400).json({ error: 'bad_request', message: 'JSON inválido' })
  }
  console.log('erro inesperado', err)
  res.status(500).json({ error: 'internal_error', message: 'Erro interno' })
}
