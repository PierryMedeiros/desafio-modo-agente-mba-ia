import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanDatabase, prisma } from './helpers'
import { ticketRepository } from '../../src/repositories/ticket-repository'
import { replyRepository } from '../../src/repositories/reply-repository'
import { attachmentRepository } from '../../src/repositories/attachment-repository'
import { userRepository } from '../../src/repositories/user-repository'

describe('PrismaTicketRepository', () => {
  let customerId: string
  let otherCustomerId: string
  let agentId: string

  beforeAll(async () => {
    await cleanDatabase()
    customerId = (await userRepository.create({ name: 'Cliente', email: 'cliente@teste.dev', passwordHash: 'x' })).id
    otherCustomerId = (await userRepository.create({ name: 'Outro', email: 'outro@teste.dev', passwordHash: 'x' })).id
    agentId = (await userRepository.create({ name: 'Agente', email: 'agente@teste.dev', passwordHash: 'x', role: 'agent' })).id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('cria chamado com os padrões', async () => {
    const ticket = await ticketRepository.create({ title: 'Teste', description: 'Descrição de teste', customerId })
    expect(ticket.status).toBe('open')
    expect(ticket.triageStatus).toBe('pending')
    expect(ticket.category).toBeNull()
    expect(ticket.assigneeId).toBeNull()
  })

  it('lista paginado, mais recentes primeiro, filtrando por cliente e status', async () => {
    for (let i = 0; i < 22; i++) {
      await ticketRepository.create({ title: `Chamado ${i}`, description: 'Descrição de teste', customerId: otherCustomerId })
    }
    const page1 = await ticketRepository.list({ customerId: otherCustomerId }, 1, 20)
    expect(page1.total).toBe(22)
    expect(page1.items).toHaveLength(20)
    expect(page1.items[0].title).toBe('Chamado 21')

    const page2 = await ticketRepository.list({ customerId: otherCustomerId }, 2, 20)
    expect(page2.items).toHaveLength(2)

    const resolved = await ticketRepository.list({ status: 'resolved' }, 1, 20)
    expect(resolved.total).toBe(0)
  })

  it('atualiza status e responsável', async () => {
    const ticket = await ticketRepository.create({ title: 'Assumir', description: 'Descrição de teste', customerId })
    const updated = await ticketRepository.update(ticket.id, { status: 'in_progress', assigneeId: agentId })
    expect(updated.status).toBe('in_progress')
    expect(updated.assigneeId).toBe(agentId)
  })

  it('traz respostas e anexos no detalhe', async () => {
    const ticket = await ticketRepository.create({ title: 'Detalhe', description: 'Descrição de teste', customerId })
    await replyRepository.create({ ticketId: ticket.id, authorId: agentId, body: 'Primeira' })
    await replyRepository.create({ ticketId: ticket.id, authorId: customerId, body: 'Segunda' })
    const attachment = await attachmentRepository.create({
      ticketId: ticket.id,
      uploaderId: customerId,
      originalName: 'print.png',
      storedName: 'abc.png',
      mimeType: 'image/png',
      sizeBytes: 123,
    })

    const detail = (await ticketRepository.findByIdWithDetails(ticket.id))!
    expect(detail.replies.map((r) => r.body)).toEqual(['Primeira', 'Segunda'])
    expect(detail.replies[0].author.name).toBe('Agente')
    expect(detail.attachments).toHaveLength(1)

    const found = await attachmentRepository.findById(attachment.id)
    expect(found?.originalName).toBe('print.png')
  })
})
