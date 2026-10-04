import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it } from 'vitest'
import { errorHandler, HttpError } from './errors'
import { DomainError, DomainErrorCode } from '../domain/errors'

function handle(err: unknown) {
  const sent: { status?: number; body?: unknown } = {}
  const res = {
    headersSent: false,
    status(code: number) {
      sent.status = code
      return this
    },
    json(body: unknown) {
      sent.body = body
      return this
    },
  }
  const next: NextFunction = () => undefined
  errorHandler(err, {} as Request, res as unknown as Response, next)
  return sent
}

describe('errorHandler', () => {
  // Os services lançam DomainError; o status HTTP de cada código é contrato da API.
  const cases: [DomainErrorCode, number][] = [
    ['validation_error', 422],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['not_found', 404],
    ['invalid_transition', 409],
    ['email_taken', 409],
    ['invalid_credentials', 401],
    ['file_too_large', 413],
    ['unsupported_type', 415],
  ]

  it.each(cases)('traduz %s para %i', (code, status) => {
    expect(handle(new DomainError(code, 'mensagem'))).toEqual({ status, body: { error: code, message: 'mensagem' } })
  })

  it('mantém HttpError como está', () => {
    expect(handle(new HttpError(422, 'validation_error', 'x'))).toEqual({
      status: 422,
      body: { error: 'validation_error', message: 'x' },
    })
  })

  it('JSON inválido vira 400', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' })
    expect(handle(err)).toEqual({ status: 400, body: { error: 'bad_request', message: 'JSON inválido' } })
  })
})
