export const API_URL = process.env.API_URL || 'http://localhost:4000'

export const seed = {
  admin: { email: 'admin@balcao.dev', password: 'Admin@123' },
  agent: { email: 'agente@balcao.dev', password: 'Agente@123' },
  customer: { email: 'cliente@balcao.dev', password: 'Cliente@123' },
}

type Options = {
  method?: string
  token?: string
  json?: unknown
  form?: FormData
  headers?: Record<string, string>
}

export async function request(path: string, options: Options = {}) {
  const headers: Record<string, string> = { ...options.headers }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  let body: BodyInit | undefined
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.json)
  } else if (options.form) {
    body = options.form
  }
  const res = await fetch(`${API_URL}${path}`, { method: options.method || 'GET', headers, body })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, body: data, headers: res.headers }
}

export function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function login(email: string, password: string) {
  const res = await request('/api/auth/login', { method: 'POST', json: { email, password } })
  if (res.status !== 200) throw new Error(`login falhou para ${email}: ${res.status}`)
  return res.body as { token: string; user: { id: string; name: string; email: string; role: string } }
}

export async function loginSeed(who: keyof typeof seed) {
  return login(seed[who].email, seed[who].password)
}

export async function newCustomer(name = 'Cliente Teste') {
  const email = `${unique('cliente')}@teste.dev`
  const password = 'senha-forte-123'
  const res = await request('/api/auth/register', { method: 'POST', json: { name, email, password } })
  if (res.status !== 201) throw new Error(`cadastro falhou: ${res.status}`)
  return login(email, password)
}

export async function createTicket(token: string, title?: string, description = 'Descrição gerada pelo teste caixa-preta') {
  const res = await request('/api/tickets', {
    method: 'POST',
    token,
    json: { title: title || unique('Chamado'), description },
  })
  if (res.status !== 201) throw new Error(`criação de chamado falhou: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

export async function waitForTriage(token: string, id: string, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await request(`/api/tickets/${id}`, { token })
    if (res.body.triageStatus !== 'pending') return res.body
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`chamado ${id} continua em triagem depois de ${timeoutMs}ms`)
}
