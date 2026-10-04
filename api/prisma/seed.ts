import { Prisma, PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Idempotente: a subida roda a seed toda vez. As contas entram por upsert (e-mail único)
// e os chamados de exemplo só são criados se ainda não existirem para o cliente da seed.
async function upsertUser(name: string, email: string, password: string, role: Role) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, role, passwordHash: await bcrypt.hash(password, 10) },
  })
}

async function createTicketOnce(data: Prisma.TicketUncheckedCreateInput) {
  const existing = await prisma.ticket.findFirst({ where: { title: data.title, customerId: data.customerId } })
  if (!existing) await prisma.ticket.create({ data })
}

async function main() {
  const admin = await upsertUser('Admin', 'admin@balcao.dev', 'Admin@123', 'admin')
  const agent = await upsertUser('Ana Atendente', 'agente@balcao.dev', 'Agente@123', 'agent')
  const customer = await upsertUser('Carlos Cliente', 'cliente@balcao.dev', 'Cliente@123', 'customer')

  await createTicketOnce({
    title: 'Não consigo emitir a segunda via do boleto',
    description: 'Quando clico em segunda via aparece uma tela em branco. Preciso pagar até sexta.',
    customerId: customer.id,
  })

  await createTicketOnce({
    title: 'Erro ao salvar o perfil',
    description: 'Ao alterar o telefone no perfil aparece a mensagem "erro inesperado".',
    status: 'in_progress',
    category: 'technical',
    priority: 'medium',
    triageStatus: 'done',
    customerId: customer.id,
    assigneeId: agent.id,
    replies: {
      create: [{ authorId: agent.id, body: 'Oi, Carlos! Já estamos olhando o problema.' }],
    },
  })

  await createTicketOnce({
    title: 'Dúvida sobre troca de senha',
    description: 'Qual o tamanho mínimo de senha que o sistema aceita?',
    status: 'resolved',
    category: 'account',
    priority: 'low',
    triageStatus: 'done',
    customerId: customer.id,
    assigneeId: agent.id,
    replies: {
      create: [
        { authorId: agent.id, body: 'A senha precisa ter pelo menos 8 caracteres.' },
        { authorId: customer.id, body: 'Obrigado!' },
      ],
    },
  })

  console.log(`seed ok: ${admin.email}, ${agent.email}, ${customer.email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
