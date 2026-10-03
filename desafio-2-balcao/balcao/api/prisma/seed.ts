import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@balcao.dev',
      passwordHash: await bcrypt.hash('Admin@123', 10),
      role: 'admin',
    },
  })

  const agent = await prisma.user.create({
    data: {
      name: 'Ana Atendente',
      email: 'agente@balcao.dev',
      passwordHash: await bcrypt.hash('Agente@123', 10),
      role: 'agent',
    },
  })

  const customer = await prisma.user.create({
    data: {
      name: 'Carlos Cliente',
      email: 'cliente@balcao.dev',
      passwordHash: await bcrypt.hash('Cliente@123', 10),
      role: 'customer',
    },
  })

  await prisma.ticket.create({
    data: {
      title: 'Não consigo emitir a segunda via do boleto',
      description: 'Quando clico em segunda via aparece uma tela em branco. Preciso pagar até sexta.',
      customerId: customer.id,
    },
  })

  await prisma.ticket.create({
    data: {
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
    },
  })

  await prisma.ticket.create({
    data: {
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
