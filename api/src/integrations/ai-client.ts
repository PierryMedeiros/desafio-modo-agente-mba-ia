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

export type AiOptions = {
  mode: 'fake' | 'openai'
  apiKey?: string
}

// Sem configuração explícita, a IA é a fake (o modo vem de AI_MODE via api/src/config/).
const FAKE: AiOptions = { mode: 'fake' }

function openaiClient(options: AiOptions) {
  return new OpenAI({ apiKey: options.apiKey })
}

async function classifyWithOpenAI(ticket: TicketInput, options: AiOptions): Promise<Classification> {
  const completion = await openaiClient(options).chat.completions.create({
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

export async function classifyTicket(ticket: TicketInput, options: AiOptions = FAKE): Promise<Classification> {
  if (options.mode === 'openai') {
    return classifyWithOpenAI(ticket, options)
  }
  return classifyFake(ticket)
}

/** Sugestão de resposta do POST /api/tickets/:id/suggest-reply. No modo openai devolve o texto do modelo (pode ser null). */
export async function suggestReply(
  input: { customerName: string; title: string; description: string },
  options: AiOptions = FAKE,
): Promise<string | null> {
  if (options.mode === 'openai') {
    const completion = await openaiClient(options).chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'Você é um atendente de suporte. Escreva uma resposta curta e educada, em português, para o chamado.',
        },
        { role: 'user', content: `Cliente: ${input.customerName}\nTítulo: ${input.title}\n\n${input.description}` },
      ],
    })
    return completion.choices[0].message.content
  }
  return suggestReplyFake(input)
}
