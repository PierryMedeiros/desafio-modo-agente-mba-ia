// Extrai a mensagem de um erro capturado em catch, que chega como unknown.
// Mesmo texto de antes (err.message); sem mensagem, devolve '' e nada é exibido.
export function errorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return ''
}
