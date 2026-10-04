import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { AttachmentService, UploadedFile } from './attachment-service'
import { TicketService } from './ticket-service'
import { DomainError } from '../domain/errors'
import { Attachment, CurrentUser, Ticket } from '../domain/ticket'

function fakeTicketService(ticket: Pick<Ticket, 'id' | 'customerId'>) {
  return {
    getById: async (user: CurrentUser, id: string) => {
      if (id !== ticket.id || (user.role === 'customer' && user.id !== ticket.customerId)) {
        throw new DomainError('not_found', 'Chamado não encontrado')
      }
      return ticket
    },
  } as unknown as TicketService
}

const fakeAttachments = {
  create: async (data: Omit<Attachment, 'id' | 'createdAt'>) => ({ id: 'att1', createdAt: new Date(), ...data }),
  findById: async () => null,
}

const ticket = { id: 't1', customerId: 'c1' }
const customer: CurrentUser = { id: 'c1', role: 'customer' }

function file(data: Pick<UploadedFile, 'size' | 'mimeType' | 'originalName'>): UploadedFile {
  return { ...data, buffer: Buffer.from('') }
}

describe('AttachmentService', () => {
  const uploadDir = path.join(os.tmpdir(), 'balcao-attachment-service-test')
  const service = new AttachmentService(fakeAttachments, fakeTicketService(ticket), uploadDir)

  it('exige arquivo', async () => {
    await expect(service.upload(customer, 't1', undefined)).rejects.toMatchObject({ code: 'validation_error' })
  })

  it('recusa arquivo maior que 5 MB', async () => {
    const big = file({ size: 5 * 1024 * 1024 + 1, mimeType: 'text/plain', originalName: 'a.txt' })
    await expect(service.upload(customer, 't1', big)).rejects.toMatchObject({ code: 'file_too_large' })
  })

  it('recusa tipo não suportado', async () => {
    const gif = file({ size: 10, mimeType: 'image/gif', originalName: 'a.gif' })
    await expect(service.upload(customer, 't1', gif)).rejects.toMatchObject({ code: 'unsupported_type' })
  })

  it('não deixa outro cliente enviar', async () => {
    const other: CurrentUser = { id: 'c2', role: 'customer' }
    await expect(service.upload(other, 't1', undefined)).rejects.toMatchObject({ code: 'not_found' })
  })
})
