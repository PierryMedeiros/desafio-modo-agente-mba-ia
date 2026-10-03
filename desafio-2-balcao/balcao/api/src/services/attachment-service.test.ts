import { describe, expect, it } from 'vitest'
import { AttachmentService } from './attachment-service'
import { TicketService } from './ticket-service'

function fakeTicketService(ticket: any) {
  return {
    getById: async (user: any, id: string) => {
      if (id !== ticket.id || (user.role === 'customer' && user.id !== ticket.customerId)) {
        const { HttpError } = await import('../http/errors')
        throw new HttpError(404, 'not_found', 'Chamado não encontrado')
      }
      return ticket
    },
  } as unknown as TicketService
}

const fakeAttachments = {
  create: async (data: any) => ({ id: 'att1', createdAt: new Date(), ...data }),
  findById: async () => null,
}

const ticket = { id: 't1', customerId: 'c1' }

describe('AttachmentService', () => {
  const service = new AttachmentService(fakeAttachments, fakeTicketService(ticket))

  it('exige arquivo', async () => {
    const req: any = { user: { id: 'c1', role: 'customer' } }
    await expect(service.upload(req, 't1')).rejects.toMatchObject({ status: 422 })
  })

  it('recusa arquivo maior que 5 MB', async () => {
    const req: any = {
      user: { id: 'c1', role: 'customer' },
      file: { size: 5 * 1024 * 1024 + 1, mimetype: 'text/plain', originalname: 'a.txt', buffer: Buffer.from('') },
    }
    await expect(service.upload(req, 't1')).rejects.toMatchObject({ status: 413, code: 'file_too_large' })
  })

  it('recusa tipo não suportado', async () => {
    const req: any = {
      user: { id: 'c1', role: 'customer' },
      file: { size: 10, mimetype: 'image/gif', originalname: 'a.gif', buffer: Buffer.from('') },
    }
    await expect(service.upload(req, 't1')).rejects.toMatchObject({ status: 415, code: 'unsupported_type' })
  })

  it('não deixa outro cliente enviar', async () => {
    const req: any = { user: { id: 'c2', role: 'customer' } }
    await expect(service.upload(req, 't1')).rejects.toMatchObject({ status: 404 })
  })
})
