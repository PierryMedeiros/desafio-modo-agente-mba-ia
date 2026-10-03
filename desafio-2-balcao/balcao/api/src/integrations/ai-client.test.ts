import { describe, expect, it } from 'vitest'
import { classifyFake, classifyTicket, suggestReplyFake } from './ai-client'

describe('classifyFake', () => {
  it('classifica cobrança como billing', () => {
    const result = classifyFake({ title: 'Cobrança em dobro', description: 'Veio duas vezes na fatura deste mês' })
    expect(result.category).toBe('billing')
  })

  it('classifica problema de senha como account', () => {
    const result = classifyFake({ title: 'Esqueci a senha', description: 'Não recebo o e-mail de recuperação' })
    expect(result.category).toBe('account')
  })

  it('classifica erro como technical', () => {
    const result = classifyFake({ title: 'Tela travou', description: 'O app travou ao abrir o relatório' })
    expect(result.category).toBe('technical')
  })

  it('usa other quando nada bate', () => {
    expect(classifyFake({ title: 'Elogio', description: 'Gostei muito do atendimento de ontem' })).toEqual({
      category: 'other',
      priority: 'medium',
    })
  })

  it('respeita a ordem das regras de categoria', () => {
    const result = classifyFake({ title: 'Erro no boleto', description: 'O boleto veio com erro no valor' })
    expect(result.category).toBe('billing')
  })

  it('ignora acentos e maiúsculas', () => {
    const result = classifyFake({ title: 'NÃO FUNCIONA', description: 'Está tudo PARADO desde cedo' })
    expect(result).toEqual({ category: 'technical', priority: 'urgent' })
  })

  it('marca urgente', () => {
    expect(classifyFake({ title: 'Site fora do ar', description: 'Ninguém consegue entrar no site' }).priority).toBe('urgent')
  })

  it('marca alta para nao consigo e bloqueado', () => {
    expect(classifyFake({ title: 'Não consigo pagar', description: 'O botão de pagar some da tela' }).priority).toBe('high')
    expect(classifyFake({ title: 'Conta bloqueada', description: 'Minha conta foi bloqueada ontem' })).toEqual({
      category: 'account',
      priority: 'high',
    })
  })

  it('marca baixa para dúvida e sugestão', () => {
    expect(classifyFake({ title: 'Dúvida', description: 'Como exporto os dados para planilha?' }).priority).toBe('low')
    expect(classifyFake({ title: 'Sugestão', description: 'Poderiam ter um modo escuro na tela' }).priority).toBe('low')
  })

  it('lança erro com [falha-ia] no título', () => {
    expect(() => classifyFake({ title: 'Teste [falha-ia]', description: 'qualquer descrição aqui' })).toThrow()
  })
})

describe('classifyTicket', () => {
  it('usa o fake por padrão', async () => {
    const result = await classifyTicket({ title: 'Reembolso', description: 'Quero o reembolso da compra' })
    expect(result.category).toBe('billing')
  })
})

describe('suggestReplyFake', () => {
  it('monta a resposta padrão', () => {
    expect(suggestReplyFake({ customerName: 'Maria', title: 'Erro no login' })).toBe(
      'Olá, Maria! Recebemos o seu chamado "Erro no login" e a nossa equipe já está analisando.',
    )
  })
})
