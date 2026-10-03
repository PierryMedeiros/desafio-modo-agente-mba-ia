import OpenAI from 'openai'
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TicketCategory, TicketPriority } from '../domain/ticket'

export type Classification = {
  category: TicketCategory
  priority: TicketPriority
}

type TicketInput = {
  title: string
  description: string
}

const MODEL = 'gpt-4o-mini'

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function containsAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w))
}

export function classifyFake(ticket: TicketInput): Classification {
  if (ticket.title.toLowerCase().includes('[falha-ia]')) {
    throw new Error('classificacao falhou')
  }
  const text = normalize(`${ticket.title} ${ticket.description}`)

  let category: TicketCategory = 'other'
  if (containsAny(text, ['fatura', 'cobranca', 'boleto', 'pagamento', 'reembolso'])) category = 'billing'
  else if (containsAny(text, ['senha', 'login', 'acesso', 'conta bloqueada'])) category = 'account'
  else if (containsAny(text, ['erro', 'bug', 'falha', 'nao funciona', 'travou'])) category = 'technical'

  let priority: TicketPriority = 'medium'
  if (containsAny(text, ['urgente', 'fora do ar', 'parado'])) priority = 'urgent'
  else if (containsAny(text, ['nao consigo', 'bloquead'])) priority = 'high'
  else if (containsAny(text, ['duvida', 'sugestao'])) priority = 'low'

  return { category, priority }
}

export function suggestReplyFake(input: { customerName: string; title: string }) {
  return `Olá, ${input.customerName}! Recebemos o seu chamado "${input.title}" e a nossa equipe já está analisando.`
}

function openaiClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

async function classifyWithOpenAI(ticket: TicketInput): Promise<Classification> {
  const completion = await openaiClient().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Você classifica chamados de suporte. Responda só com JSON no formato {"category": "...", "priority": "..."}. ' +
          `category: ${TICKET_CATEGORIES.join(', ')}. priority: ${TICKET_PRIORITIES.join(', ')}.`,
      },
      { role: 'user', content: `Título: ${ticket.title}\n\nDescrição: ${ticket.description}` },
    ],
  })
  const data = JSON.parse(completion.choices[0].message.content || '{}')
  if (!TICKET_CATEGORIES.includes(data.category) || !TICKET_PRIORITIES.includes(data.priority)) {
    throw new Error('resposta da IA fora do formato')
  }
  return { category: data.category, priority: data.priority }
}

export async function classifyTicket(ticket: TicketInput): Promise<Classification> {
  if (process.env.AI_MODE === 'openai') {
    return classifyWithOpenAI(ticket)
  }
  return classifyFake(ticket)
}

export async function suggestReply(input: { customerName: string; title: string; description: string }) {
  if (process.env.AI_MODE === 'openai') {
    const completion = await openaiClient().chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Você é um atendente de suporte educado. Escreva uma resposta curta em português.' },
        { role: 'user', content: `Cliente: ${input.customerName}\nTítulo: ${input.title}\n\n${input.description}` },
      ],
    })
    return completion.choices[0].message.content || ''
  }
  return suggestReplyFake(input)
}
