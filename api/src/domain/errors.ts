// Erros de negócio. Os services lançam DomainError com um código; a camada http
// traduz o código para o status HTTP (api/src/http/errors.ts).
export type DomainErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_transition'
  | 'email_taken'
  | 'invalid_credentials'
  | 'file_too_large'
  | 'unsupported_type'

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}
