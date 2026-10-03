import { describe, expect, it } from 'vitest'
import { createTicket, loginSeed, newCustomer, request, unique } from './helpers'

function fileForm(bytes: Uint8Array, type: string, name: string) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type }), name)
  return form
}

describe('anexos', () => {
  it('cliente envia e baixa o mesmo arquivo', async () => {
    const customer = await newCustomer()
    const ticket = await createTicket(customer.token)
    const content = new TextEncoder().encode(`conteúdo ${unique('arquivo')}\nsegunda linha`)

    const upload = await request(`/api/tickets/${ticket.id}/attachments`, {
      method: 'POST',
      token: customer.token,
      form: fileForm(content, 'text/plain', 'nota.txt'),
    })
    expect(upload.status).toBe(201)
    expect(upload.body).toMatchObject({
      ticketId: ticket.id,
      uploaderId: customer.user.id,
      originalName: 'nota.txt',
      mimeType: 'text/plain',
      sizeBytes: content.length,
    })

    const detail = await request(`/api/tickets/${ticket.id}`, { token: customer.token })
    expect(detail.body.attachments.map((a: any) => a.id)).toEqual([upload.body.id])

    const res = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/api/attachments/${upload.body.id}/download`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(res.headers.get('content-disposition')).toContain('nota.txt')
    const downloaded = new Uint8Array(await res.arrayBuffer())
    expect(Buffer.compare(Buffer.from(downloaded), Buffer.from(content))).toBe(0)
  })

  it('atendente envia png e admin baixa', async () => {
    const customer = await newCustomer()
    const ticket = await createTicket(customer.token)
    const agent = await loginSeed('agent')
    const admin = await loginSeed('admin')
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 255, 0, 128])

    const upload = await request(`/api/tickets/${ticket.id}/attachments`, {
      method: 'POST',
      token: agent.token,
      form: fileForm(png, 'image/png', 'print.png'),
    })
    expect(upload.status).toBe(201)

    const res = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/api/attachments/${upload.body.id}/download`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/png')
    expect(Buffer.compare(Buffer.from(await res.arrayBuffer()), Buffer.from(png))).toBe(0)
  })

  it('aceita até 5 MB e recusa acima com 413', async () => {
    const customer = await newCustomer()
    const ticket = await createTicket(customer.token)
    const limit = 5 * 1024 * 1024

    const ok = await request(`/api/tickets/${ticket.id}/attachments`, {
      method: 'POST',
      token: customer.token,
      form: fileForm(new Uint8Array(limit), 'application/pdf', 'limite.pdf'),
    })
    expect(ok.status).toBe(201)

    const tooBig = await request(`/api/tickets/${ticket.id}/attachments`, {
      method: 'POST',
      token: customer.token,
      form: fileForm(new Uint8Array(limit + 1), 'application/pdf', 'grande.pdf'),
    })
    expect(tooBig.status).toBe(413)
    expect(tooBig.body.error).toBe('file_too_large')
  })

  it('recusa tipo não suportado com 415', async () => {
    const customer = await newCustomer()
    const ticket = await createTicket(customer.token)
    const res = await request(`/api/tickets/${ticket.id}/attachments`, {
      method: 'POST',
      token: customer.token,
      form: fileForm(new Uint8Array([1, 2, 3]), 'image/gif', 'anim.gif'),
    })
    expect(res.status).toBe(415)
    expect(res.body.error).toBe('unsupported_type')
  })

  it('outro cliente não envia nem baixa', async () => {
    const owner = await newCustomer()
    const intruder = await newCustomer()
    const ticket = await createTicket(owner.token)
    const upload = await request(`/api/tickets/${ticket.id}/attachments`, {
      method: 'POST',
      token: owner.token,
      form: fileForm(new TextEncoder().encode('segredo'), 'text/plain', 'segredo.txt'),
    })
    expect(upload.status).toBe(201)

    const denied = await request(`/api/tickets/${ticket.id}/attachments`, {
      method: 'POST',
      token: intruder.token,
      form: fileForm(new TextEncoder().encode('x'), 'text/plain', 'x.txt'),
    })
    expect(denied.status).toBe(404)

    const download = await request(`/api/attachments/${upload.body.id}/download`, { token: intruder.token })
    expect(download.status).toBe(404)
    expect(download.body.error).toBe('not_found')
  })

  it('download sem token responde 401 e anexo inexistente 404', async () => {
    const noToken = await request('/api/attachments/qualquer/download')
    expect(noToken.status).toBe(401)
    const { token } = await loginSeed('admin')
    const missing = await request('/api/attachments/00000000-0000-0000-0000-000000000000/download', { token })
    expect(missing.status).toBe(404)
  })
})
