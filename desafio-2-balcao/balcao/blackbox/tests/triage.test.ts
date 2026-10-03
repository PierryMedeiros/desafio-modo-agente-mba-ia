import { describe, expect, it } from 'vitest'
import { createTicket, newCustomer, unique, waitForTriage } from './helpers'

const cases = [
  {
    title: 'Fatura com valor errado',
    description: 'Preciso disso urgente, o valor da fatura veio dobrado',
    category: 'billing',
    priority: 'urgent',
  },
  {
    title: 'Não consigo trocar a senha',
    description: 'O link de troca de senha expira na hora',
    category: 'account',
    priority: 'high',
  },
  {
    title: 'O relatório travou',
    description: 'Ao gerar o relatório mensal a tela fica branca',
    category: 'technical',
    priority: 'medium',
  },
  {
    title: 'Sugestão de melhoria',
    description: 'Seria ótimo poder exportar em planilha',
    category: 'other',
    priority: 'low',
  },
]

describe('triagem fake', () => {
  for (const c of cases) {
    it(`classifica "${c.title}" como ${c.category}/${c.priority}`, async () => {
      const { token } = await newCustomer()
      const ticket = await createTicket(token, `${c.title} ${unique('')}`, c.description)
      const triaged = await waitForTriage(token, ticket.id)
      expect(triaged.triageStatus).toBe('done')
      expect(triaged.category).toBe(c.category)
      expect(triaged.priority).toBe(c.priority)
    }, 20000)
  }

  it('marca failed quando a classificação falha', async () => {
    const { token } = await newCustomer()
    const ticket = await createTicket(token, `Teste [falha-ia] ${unique('')}`, 'Pagamento recusado sem motivo')
    const triaged = await waitForTriage(token, ticket.id)
    expect(triaged.triageStatus).toBe('failed')
    expect(triaged.category).toBeNull()
    expect(triaged.priority).toBeNull()
  }, 20000)
})
