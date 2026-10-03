Projeto: MBA em Engenharia de Software com IA
Fase do projeto: Desenvolvimento em modo agente, desafio 1

# Catraca: do brief ao produto em modo agente

A Catraca vende ingressos para eventos pequenos: shows em bar, workshops, meetups. A fundadora descreveu o produto em uma página e o time decidiu construir o MVP em modo agente. A primeira tentativa foi rápida e enganosa. Cada feature saiu redonda na própria sessão: a compra funcionava, o check-in funcionava, o cancelamento funcionava. Juntas, não. Evento cancelado continuava deixando gente entrar, o painel somava estorno como receita e, num pico de vendas, um show de 100 lugares vendeu 112 ingressos. Cada agente jurava que a sua parte estava pronta, e estava, sozinha.

O código da primeira tentativa foi descartado. Você começa do zero, só com o brief, e entrega o MVP construído por agentes, com especificações que se conectam e com cada feature aprovada por um avaliador que não foi quem a implementou. A tensão do desafio está toda aí: features que funcionam sozinhas e quebram quando se encontram, e agentes que dão o próprio trabalho como pronto.

## Objetivo

Entregar, em um repositório público no GitHub:

- o produto Catraca funcionando conforme o brief e subindo com um único comando;
- o PRD, com features, dependências, waves e critérios de aceite, inclusive os que atravessam features;
- spec, plano e contrato de cada feature;
- os relatórios de avaliação de cada feature, produzidos por um agente separado do implementador;
- o arquivo de estado do projeto;
- o harness mínimo: comandos de subir, derrubar e rodar os gates, seed e `AGENTS.md`;
- pelo menos uma wave entregue em paralelo, integrada por PRs;
- um README que diz como rodar e onde está cada artefato.

Esforço de referência: XX horas (placeholder, calibrado após a execução de referência).

## Comportamento esperado: o brief

Esta seção é o brief da fundadora. Tudo que o avaliador testa no produto está aqui; o resto (stack, telas, divisão em features, modelagem) é decisão sua. As regras têm identificador, de R01 a R13, para que o seu PRD e os seus contratos possam rastreá-las.

### Quem usa

- Visitante: sem login, vê a vitrine de eventos.
- Participante: cria a própria conta (nome, e-mail e senha), entra, sai, compra ingressos e vê os próprios ingressos.
- Organizador: não se cadastra pelo produto; as contas de organizador vêm da seed. Cria e opera os próprios eventos.
- Parceiro: sistema externo que vende ingressos pela API de parceiros, autenticado por uma chave.

### Status do ingresso

Na interface aparece o rótulo; na API, o valor.

| Rótulo | Valor na API | Quando |
|---|---|---|
| pendente | `pending` | compra criada, aguardando a resposta do gateway |
| confirmado | `confirmed` | o gateway aprovou |
| recusado | `declined` | o gateway recusou |
| cancelado | `cancelled` | estava pendente quando o evento foi cancelado |
| estornado | `refunded` | estava confirmado quando o evento foi cancelado |

Ter passado pelo check-in não é um status: é uma informação à parte (na API, o campo `checkedIn`).

### Regras

Eventos

- R01. Um evento tem nome, data e hora de início, local, lotação (inteiro, mínimo 1) e preço (em reais, maior que zero). A data de início precisa estar no futuro, ao criar e ao editar.
- R02. Todo evento nasce como rascunho. Só evento publicado e não cancelado aparece na vitrine e na listagem da API de parceiros e aceita compras.
- R03. A lotação nunca pode ficar menor que as vagas ocupadas (R05). Mudança de preço vale só para as compras feitas depois dela.
- R04. Cada evento tem uma página de gestão com endereço (URL) próprio, onde o organizador edita, publica, cancela, faz o check-in e vê o painel.

Vagas e compra

- R05. Vagas ocupadas são os ingressos pendentes mais os confirmados. Vagas disponíveis são a lotação menos as vagas ocupadas.
- R06. Cada compra é de um ingresso, feita pelo participante na vitrine ou pelo parceiro na API. A compra nasce pendente, já ocupa vaga e é respondida sem esperar o gateway.
- R07. Sem vaga disponível, a compra é recusada: a vitrine exibe `Ingressos esgotados` (no lugar da compra ou como resposta à tentativa) e a API responde `sold_out`. As vagas ocupadas nunca passam da lotação, nem com compras simultâneas.
- R08. Quando o gateway aprova, o ingresso fica confirmado. Quando recusa, fica recusado e a vaga é liberada.
- R09. Cada ingresso tem um código único, usado no check-in. Em "Meus ingressos", o participante vê o evento, o status e o código de cada ingresso que comprou.

Check-in

- R10. Na página de gestão do evento, o organizador informa o código de um ingresso. A primeira linha verdadeira da tabela abaixo define a mensagem exibida. Em evento cancelado, a mensagem `Evento cancelado` pode aparecer no lugar do campo de check-in.

| Ordem | Situação do código | Mensagem |
|---|---|---|
| 1 | não existe ou é de outro evento | `Ingresso inválido para este evento` |
| 2 | o evento está cancelado | `Evento cancelado` |
| 3 | o ingresso não está confirmado | `Ingresso não confirmado` |
| 4 | o ingresso já passou pelo check-in | `Ingresso já utilizado` |
| 5 | nenhuma das anteriores | `Entrada liberada` |

Cancelamento

- R11. O organizador pode cancelar um evento publicado, e o cancelamento é irreversível: o evento sai da vitrine e da API, não vende mais e não pode ser editado nem republicado. Em até 10 segundos, os ingressos confirmados passam a estornados e os pendentes a cancelados. Resposta do gateway que chegue depois não muda o status de nenhum deles.

Painel

- R12. A página de gestão mostra o painel do evento, contando as vendas da vitrine e da API com as definições abaixo.

| Número | Definição |
|---|---|
| Confirmados | ingressos confirmados, inclusive os que já passaram pelo check-in |
| Pendentes | ingressos pendentes |
| Check-ins | ingressos confirmados que já passaram pelo check-in |
| Vagas disponíveis | conforme R05 |
| Receita | soma do valor pago pelos ingressos confirmados, com o preço vigente no momento de cada compra |
| Estornados | ingressos estornados |

Acesso

- R13. Na área de organizador, cada organizador só vê e opera os próprios eventos, inclusive quando acessa diretamente o endereço da página de gestão de um evento de outro organizador. Participante e visitante não acessam a área de organizador.

Uma observação sobre R07: garantir a lotação sob compras simultâneas não é abordado no módulo. Pesquisar como garantir essa regra, e como provar que ela vale, faz parte do desafio.

### Gateway de pagamento simulado

O pagamento passa por um gateway externo. No modo padrão do produto, que é o que o avaliador usa, o gateway é simulado e responde conforme o final do número do cartão:

| Final do cartão | Resultado | Quando a resposta chega |
|---|---|---|
| `0001` | aprovado | em até 5 segundos |
| `0002` | recusado | em até 5 segundos |
| `0003` | aprovado | entre 60 e 75 segundos |
| `0004` | recusado | entre 60 e 75 segundos |
| qualquer outro | recusado | em até 5 segundos |

O número do cartão tem 16 dígitos (ex.: `4000000000000001`); fora disso, a compra é rejeitada antes de criar o ingresso.

### API de parceiros (contrato fixo)

A API de parceiros tem contrato fixo porque o avaliador conversa com ela pela linha de comando. Toda rota exige o cabeçalho `X-Api-Key` com a chave de parceiro documentada no README; sem ele, ou com chave inválida, a resposta é `401` com `{"error":"unauthorized"}`. Os IDs são strings, no formato que você escolher.

Eventos à venda (publicados e não cancelados), com `availableSeats` igual às vagas disponíveis de R05:

```
GET /api/partner/events

200
[
  {
    "id": "evt_8f2k",
    "name": "Jazz no Porão",
    "startsAt": "2026-12-05T21:00:00-03:00",
    "priceCents": 10000,
    "availableSeats": 2
  }
]
```

Compra de um ingresso:

```
POST /api/partner/events/{eventId}/purchases
Content-Type: application/json

{ "buyerEmail": "ana@example.com", "cardNumber": "4000000000000001" }

202
{ "ticketId": "tkt_51xq", "code": "K7Q2M9XA", "status": "pending" }
```

Depois da chave, os erros da compra são verificados nesta ordem: corpo inválido (campo faltando, e-mail mal formado ou cartão sem 16 dígitos) responde `422` com `{"error":"invalid_request"}`; evento inexistente, em rascunho ou cancelado responde `404` com `{"error":"event_not_available"}`; falta de vaga responde `409` com `{"error":"sold_out"}`.

Consulta de um ingresso, de qualquer canal de venda:

```
GET /api/partner/tickets/{ticketId}

200
{ "ticketId": "tkt_51xq", "code": "K7Q2M9XA", "eventId": "evt_8f2k", "status": "confirmed", "checkedIn": false }
```

Ingresso inexistente responde `404` com `{"error":"ticket_not_found"}`. Compras pela API não ficam vinculadas a contas de participante, mas valem para lotação, painel, check-in e cancelamento exatamente como as da vitrine.

## Requisitos

O brief diz o que o produto faz. Os requisitos dizem como ele precisa chegar lá.

### 1. Um PRD que conecta as features

Conceitos do curso: SDD - Fundamentos (PRD Writer, Consumes/Provides, grafo de dependências e waves) e Desenvolvimento paralelo com SDD (integração entre features e a regra de ouro do handoff).

O brief vira um PRD. A divisão em features é sua; ao final, o PRD precisa:

- ter pelo menos 5 features, cada uma com um ID;
- declarar o que cada feature provê e o que consome das outras;
- trazer o grafo de dependências e as waves, com pelo menos uma wave de duas ou mais features;
- ter critérios de aceite por feature e, para cada dependência do grafo, pelo menos um critério cross-feature que comprove que o que uma feature provê chega e funciona na que consome;
- citar cada regra, de R01 a R13, em pelo menos um critério;
- ter uma seção de fora de escopo.

### 2. Spec, plano e contrato por feature

Conceitos do curso: SDD - Fundamentos (Spec Writer) e Desenvolvendo projeto prático (o contrato como acordo entre implementador e avaliador).

Cada feature tem uma spec com as decisões técnicas, um plano em etapas e um contrato. O contrato é o que o avaliador vai exercitar: os pré-requisitos de ambiente, itens verificáveis por comando ou efeito observável e um mapeamento que liga cada critério da feature no PRD a pelo menos um item. Cada critério cross-feature fica coberto no contrato de pelo menos uma das features envolvidas. O formato é livre; o do curso serve.

### 3. Harness mínimo

Conceitos do curso: Introdução a Harness Engineering, Projeto prático (AGENTS.md, gates e scripts de ambiente) e Pós implementação (seed e subida do ambiente).

Agentes, avaliador e corretor precisam de um ambiente que não dependa de ninguém. Ao final:

- um comando sobe tudo a partir de um clone limpo, com a seed carregada, sem nenhum outro passo;
- um comando derruba tudo que a subida iniciou;
- um comando roda os gates do projeto, testes automatizados incluídos, e passa na `main`;
- a seed cria dois organizadores e um participante e pode rodar de novo sem erro; credenciais e chave de parceiro ficam no README;
- o modo padrão usa o gateway simulado, sem nenhuma chave real;
- um `AGENTS.md` na raiz é a porta de entrada dos agentes, com esses comandos, as regras do projeto e o mapa dos artefatos; se a sua ferramenta lê outro arquivo (ex.: `CLAUDE.md`), ele aponta para o `AGENTS.md`.

### 4. Entrega em waves, com uma em paralelo

Conceitos do curso: Desenvolvimento paralelo com SDD (worktrees e conflitos) e Paralelização e tmux.

As features são implementadas por agentes, na ordem das waves do PRD. Pelo menos uma wave de duas ou mais features é implementada em paralelo: cada feature na sua branch (em worktree ou equivalente), ao mesmo tempo, integradas à `main` por PRs. O histórico é a prova: o primeiro commit de cada branch da wave é anterior ao último commit das outras. Conflito de merge faz parte do jogo.

### 5. Avaliação independente

Conceitos do curso: Introdução a Harness Engineering (self-evaluation bias), Desenvolvendo projeto prático (evaluator) e Pós implementação (o ciclo de implementar, avaliar e corrigir).

Quem implementou não avalia. Cada feature é avaliada contra o seu contrato por um agente em uma sessão separada da do implementador, e cada avaliação gera um relatório novo, que não é alterado depois de commitado. O relatório registra a data, o commit avaliado, a ferramenta e o modelo usados e o veredito de cada item do contrato, com evidência (saída de comando, resposta HTTP, screenshot). Item reprovado volta para correção e para uma nova avaliação, até o relatório mais recente da feature aprovar tudo.

### 6. Estado do projeto

Conceitos do curso: Desenvolvendo projeto prático (o arquivo de tracking) e Princípios de Harness Engineering (artefatos e estado).

Um arquivo de estado (formato livre, ex.: JSON) diz, para cada feature, o status e o caminho do relatório de avaliação mais recente. Ele é a memória do projeto entre sessões e precisa bater com a realidade na entrega.

## Tecnologias e restrições

- Agente de código: Claude Code, Codex, Gemini CLI ou Cursor (pode combinar).
- Git e GitHub, com PRs.
- Docker.

A stack do produto é livre, com uma restrição: a máquina do avaliador tem só Linux ou macOS, Docker, Git e Node.js LTS, então qualquer runtime além do Node roda em container. No Windows, desenvolva no WSL.

## Fora de escopo

- Deploy e qualquer ambiente além do local.
- Gateway de pagamento real, e-mail e notificações.
- App mobile e qualidade visual: nenhum critério avalia design.
- Cadastro de organizador pelo produto.
- Mais de um ingresso por compra, mapa de assentos, cancelamento ou transferência de ingresso pelo participante.
- Atualização em tempo real: recarregar a página para ver o status novo basta.
- Fuso horário: datas no horário local da máquina.

## Critérios de aceite

Todos são obrigatórios. O Fluxo do avaliador, logo depois, mostra como cada um é verificado.

Ambiente e harness

☐ Em um clone limpo, o comando de subida do README deixa o produto acessível, com a seed carregada, sem nenhum outro passo.
☐ Depois de derrubar, subir de novo funciona sem erro, inclusive na seed.
☐ O comando de derrubar encerra tudo que a subida iniciou.
☐ O comando de gates passa na `main` e roda testes automatizados.
☐ O produto sobe e vende no modo simulado sem nenhuma chave de pagamento.
☐ O `AGENTS.md` da raiz tem os comandos de subir, derrubar e gates e o mapa dos artefatos; o arquivo específico da ferramenta, se houver, aponta para ele.

Produto

☐ Rascunho fica fora da vitrine e da listagem da API; publicado aparece (R02).
☐ Data de início no passado é rejeitada (R01).
☐ Reduzir a lotação abaixo das vagas ocupadas é rejeitado, e aumentar é aceito (R03).
☐ A compra pela vitrine nasce pendente, fica confirmada em até 5 segundos com o cartão final `0001` e aparece em "Meus ingressos" com evento, status e código (R06, R08, R09).
☐ Compra pendente ocupa vaga até a resposta do gateway, e a recusa libera a vaga (R05, R06, R08).
☐ Sem vaga, a vitrine exibe `Ingressos esgotados` e a API responde `409` com `sold_out` (R07).
☐ Em duas rodadas, cada uma em um evento novo com lotação 5, 30 compras simultâneas pela API resultam em exatamente 5 respostas `202` e 25 respostas `409` (R07).
☐ A receita usa o preço vigente em cada compra (R03, R12).
☐ O check-in exibe a mensagem exata de cada linha da tabela de R10.
☐ O evento cancelado sai da vitrine e da API, recusa compras pela API (`404` com `event_not_available`) e não pode ser editado (R11).
☐ Após o cancelamento, confirmados ficam estornados e pendentes ficam cancelados em até 10 segundos, e continuam assim depois que o gateway responde (R11).
☐ Os seis números do painel batem com o estado dos ingressos em todas as conferências do Fluxo do avaliador (R12).
☐ Na área de organizador, um organizador não vê dados de evento de outro, nem pela lista nem pelo endereço direto, e participante e visitante não acessam essa área (R13).

API de parceiros

☐ As três rotas seguem o contrato fixo: campos, status HTTP e códigos de erro.
☐ Sem chave ou com chave inválida, as três rotas respondem `401` com `unauthorized`.
☐ Compras pela API contam na lotação, no painel, no check-in e no cancelamento como as da vitrine.

Especificação

☐ O PRD tem pelo menos 5 features com ID, o que cada uma provê e consome, grafo de dependências, waves (uma delas com duas ou mais features) e seção de fora de escopo.
☐ Cada dependência do grafo tem pelo menos um critério cross-feature no PRD.
☐ Cada regra, de R01 a R13, é citada em pelo menos um critério do PRD.
☐ Cada feature tem spec, plano e contrato, e o contrato mapeia cada critério da feature a pelo menos um item verificável.
☐ Cada critério cross-feature do PRD aparece no mapeamento de pelo menos um contrato.

Avaliação e estado

☐ Cada feature tem pelo menos um relatório de avaliação com data, commit avaliado, ferramenta e modelo e veredito por item com evidência.
☐ O relatório mais recente de cada feature aprova todos os itens do contrato.
☐ Nenhum relatório foi alterado depois do commit que o criou.
☐ O arquivo de estado lista todas as features como concluídas, com o caminho do relatório mais recente, e todos os caminhos existem.

Paralelismo e entrega

☐ Uma wave de duas ou mais features foi implementada em branches separadas ao mesmo tempo: os PRs estão mergeados e listados no README, e o primeiro commit de cada branch é anterior ao último commit das outras.
☐ O README tem todas as seções descritas em Entregável.

## Fluxo do avaliador

O fluxo é público. Nele, `$WEB` e `$API` são os endereços do produto e da API de parceiros informados no README, e `$KEY` é a chave de parceiro. As contas do organizador A, do organizador B e do participante vêm da seed.

**1.** Clone o repositório em uma pasta vazia e rode o comando de subida do README. O produto fica acessível em `$WEB`, com a seed carregada, sem nenhum outro passo.

**2.** Como organizador A, crie o evento E1 (lotação 2, R$ 100,00, data no mês seguinte) sem publicar. Deslogado, a vitrine não mostra E1, e a listagem da API também não:

```
curl -s -H "X-Api-Key: $KEY" "$API/api/partner/events"
```

**3.** Ainda como A, tente criar um evento com a data de ontem: a criação é rejeitada.

**4.** Publique E1. Ele aparece na vitrine e na listagem da API com `availableSeats` 2 e `priceCents` 10000. Guarde o `id` em `$E1`.

**5.** Crie uma conta de participante nova pela interface e, com ela, compre E1 na vitrine com o cartão `4000000000000001`. Em "Meus ingressos" o ingresso aparece pendente e, em até 5 segundos (recarregando a página), confirmado. Anote o código como C1.

**6.** Compre E1 pela API com o cartão `4000000000000004`:

```
curl -s -X POST "$API/api/partner/events/$E1/purchases" \
  -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"buyerEmail":"t2@example.com","cardNumber":"4000000000000004"}'
```

A resposta é `202` com `pending`; guarde o `ticketId` em `$T2` e anote o `code` como C2. A listagem passa a mostrar E1 com `availableSeats` 0.

**7.** Antes de completar 60 segundos do passo 6, uma compra de E1 pela API com o cartão `4000000000000001` responde `409` com `sold_out`, e a vitrine exibe `Ingressos esgotados` para o participante do passo 5.

**8.** Passados 75 segundos do passo 6, `$T2` está `declined` e E1 volta a ter `availableSeats` 1:

```
curl -s -H "X-Api-Key: $KEY" "$API/api/partner/tickets/$T2"
```

Compre E1 pela API com o cartão `4000000000000001` (T3). Em até 5 segundos, T3 está `confirmed`.

**9.** Como A, tente reduzir a lotação de E1 para 1: é rejeitado. Mude o preço para R$ 150,00 e a lotação para 3: é aceito. Compre E1 pela API com o cartão `4000000000000001` (T4) e espere a confirmação. O painel de E1 mostra Confirmados 3, Pendentes 0, Check-ins 0, Vagas disponíveis 0, Receita R$ 350,00 e Estornados 0.

**10.** No check-in de E1: C1 resulta em `Entrada liberada`; C1 de novo, em `Ingresso já utilizado`; C2, em `Ingresso não confirmado`; `ZZZZZZZZ`, em `Ingresso inválido para este evento`. O painel passa a mostrar Check-ins 1. Copie o endereço da página de gestão de E1.

**11.** Como organizador B, a lista de eventos da área de organizador não mostra E1, e abrir o endereço copiado não exibe nenhum dado de E1. Ainda como B, crie e publique o evento E2 (lotação 1, R$ 20,00), pegue o `id` dele na listagem da API e compre-o com o cartão `4000000000000001`, anotando o código como C3. Como o participante da seed, e depois deslogado, o endereço copiado também não exibe dados de E1. De volta como A, C3 no check-in de E1 resulta em `Ingresso inválido para este evento`.

**12.** Como A, crie e publique o evento E3 (lotação 5, R$ 50,00), guarde o `id` em `$E3` e compre-o pela API com o cartão `4000000000000003` (`$T5`) e, logo depois, com o cartão `4000000000000001` (`$T6`, código C6). Espere T6 ficar `confirmed` e, antes de completar 60 segundos da compra de T5, cancele E3.

**13.** E3 sai da vitrine e da listagem da API, e uma compra de E3 pela API responde `404` com `event_not_available`. Em até 10 segundos, T6 está `refunded` e T5 está `cancelled`. A página de gestão de E3 não permite editar o evento.

**14.** Passados 75 segundos da compra de T5, T5 continua `cancelled`. No check-in de E3, C6 resulta em `Evento cancelado` (ou a mensagem aparece no lugar do campo). O painel de E3 mostra Confirmados 0, Pendentes 0, Check-ins 0, Receita R$ 0,00 e Estornados 1.

**15.** Como A, crie e publique o evento E4 (lotação 5, R$ 10,00), guarde o `id` em `$E4` e dispare 30 compras simultâneas:

```
seq 30 | xargs -P 30 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$API/api/partner/events/$E4/purchases" \
  -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"buyerEmail":"carga{}@example.com","cardNumber":"4000000000000001"}' | sort | uniq -c
```

A saída mostra exatamente 5 respostas `202` e 25 `409`. Em até 10 segundos, o painel de E4 mostra Confirmados 5 e Vagas disponíveis 0. Repita com um evento novo, E5, com o mesmo resultado.

**16.** Nas três rotas da API, sem o cabeçalho e com uma chave errada, a resposta é `401` com `unauthorized`. Uma compra com `"cardNumber":"123"` responde `422` com `invalid_request`, e a consulta de um `ticketId` inexistente responde `404` com `ticket_not_found`.

**17.** Rode o comando de gates: passa. Rode o de derrubar: o produto para de responder, e nenhum container ou processo iniciado pela subida continua rodando. Suba de novo: sobe sem erro, e as credenciais da seed continuam funcionando.

**18.** Pelo mapa do README, confira o PRD, a spec, o plano e o contrato de cada feature, os relatórios, o arquivo de estado, o `AGENTS.md` e os PRs da wave paralela contra os critérios de Especificação, Avaliação e estado e Paralelismo e entrega. Um relatório que nunca foi alterado aparece em um único commit:

```
git log --format="%h %ad" --date=iso -- caminho/do/relatorio.md
```

As regras do brief só valem se valerem quando as features se encontram. Se qualquer verificação dos passos 1 a 17 falhar, a entrega está incompleta, não importa o que digam os relatórios.

## Entregável

Um repositório público no GitHub, com tudo na branch `main`, cujo README tenha:

- Como rodar: pré-requisitos e os comandos de subir, derrubar e gates.
- Endereços: onde ficam o produto (`$WEB`) e a API de parceiros (`$API`).
- Credenciais: organizador A, organizador B, participante da seed e chave de parceiro.
- Mapa dos artefatos: onde estão o PRD, a pasta de cada feature (spec, plano, contrato e relatórios), o arquivo de estado e o `AGENTS.md`, mais os links dos PRs da wave paralela.
- Decisões: a stack e por quê, como R07 foi garantida sob concorrência, como a resposta assíncrona do gateway foi implementada e como a avaliação foi isolada do implementador.

Regras de entrega: um projeto por repositório; os PRs da wave paralela continuam visíveis no GitHub (as branches podem ser apagadas depois do merge).

## Dicas finais

Os cartões lentos levam mais de um minuto para responder, e esperar isso a cada teste local cansa. Nada impede que o atraso seja configurável no seu ambiente de testes, desde que o modo padrão, o do avaliador, siga a tabela do gateway.

Teste de concorrência que passa uma vez não prova nada. Rode a rajada do passo 15 várias vezes, em eventos novos, antes de confiar nela. Pelo mesmo motivo, depois do último merge rode o fluxo inteiro contra a `main`, a partir de um clone limpo: é quando as features se encontram que as falhas aparecem.

Relatório verde é promessa; o fluxo do avaliador é a cobrança.
