# Balcão: especificação da base do desafio 2 (documento interno)

Este documento é o contrato da aplicação base do desafio "Domando um legado" e, ao mesmo tempo, o pedido de construção para o Claude Code. Ele descreve os problemas plantados, por isso nunca pode ir para o repositório que o aluno recebe.

## Como usar

Esta especificação fica em `desafio-2-balcao/especificacao-base.md`, fora da pasta `balcao/`. A base é gerada pelo Claude Code dentro de `desafio-2-balcao/balcao/`, seguindo a seção Instruções para o agente, e todos os caminhos deste documento são relativos a essa pasta. Depois de validada pela seção 14, a pasta vira o repositório que o aluno recebe, extraída com histórico por `git subtree split --prefix=desafio-2-balcao/balcao -b base-balcao`.

## 1. O produto

O Balcão é a central de chamados de uma empresa fictícia. Clientes abrem chamados; uma IA faz a triagem (categoria e prioridade) em segundo plano; atendentes assumem, respondem e resolvem; o admin vê estatísticas. É um projeto que funciona, mas foi feito às pressas, por várias mãos e vários agentes, sem revisão. Ninguém sobe o ambiente sem ler o README três vezes.

## 2. Stack e versões

- Node.js 22 ou superior (campo `engines`), TypeScript 5 com `strict`, `tsx` para rodar TypeScript.
- API: Express 4, Prisma 6 (não usar Prisma 7), PostgreSQL 16, `jsonwebtoken`, `bcryptjs`, `multer`, `zod`, `cors` e o SDK oficial `openai`. TypeScript compilado como CommonJS (`"module": "commonjs"`, `esModuleInterop`), executado com `tsx`. IDs em UUID.
- Worker: processo Node separado, no mesmo pacote da API.
- Web: React com Vite e React Router, sem biblioteca de componentes. Um único `tsconfig.json` (sem project references), com `strict`, `noEmit`, `jsx: react-jsx` e `moduleResolution: bundler`, de modo que `npx tsc --noEmit` dentro de `web/` verifique de fato o código.
- Testes: Vitest na API e na suíte caixa-preta.
- Três pacotes independentes, sem workspaces e sem `package.json` na raiz: `api/`, `web/` e `blackbox/`, cada um com o seu `package.json` e o seu `package-lock.json`.
- `docker-compose.yml` na raiz só com o Postgres.
- `.gitignore` padrão de Node (`node_modules`, `.env`, `dist`).

## 3. Estrutura de pastas

As pastas e arquivos marcados como fixos são âncora da correção: o kit de sabotagem planta violações neles, e o enunciado vai proibir o aluno de renomeá-los.

```
api/
  package.json
  tsconfig.json
  .env.example
  prisma/
    schema.prisma
    migrations/
    seed.ts
  src/
    main.ts                  (fixo) entrada da API
    config/                  (fixo) env.ts: centralização começada e abandonada
    domain/                  (fixo) tipos de domínio
      ticket.ts
    http/                    (fixo) app Express, rotas, middlewares e erros HTTP
      app.ts
      errors.ts
      middlewares/
      routes/
    services/                (fixo) regras de negócio
    repositories/            (fixo) acesso a dados via Prisma
      prisma.ts
    integrations/            (fixo) cliente de IA, real e fake
      ai-client.ts
    jobs/                    (fixo)
      triage-worker.ts       (fixo) entrada do worker
    utils/
  test/
    integration/             testes que exigem banco
web/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx                 (fixo) entrada do front
    pages/
    components/
    api/                     cliente HTTP
    utils/
blackbox/
  package.json
  tests/                     suíte caixa-preta da API
docker-compose.yml
README.md
CLAUDE.md
```

Testes unitários ficam ao lado do código, no padrão `api/src/**/*.test.ts` (fixo).

## 4. Domínio

User: `id`, `name`, `email` (único), `passwordHash`, `role` (`customer`, `agent` ou `admin`), `createdAt`.

Ticket: `id`, `title` (3 a 120 caracteres), `description` (10 a 5000), `status` (`open`, `in_progress` ou `resolved`), `category` (`billing`, `technical`, `account`, `other` ou nulo), `priority` (`low`, `medium`, `high`, `urgent` ou nulo), `triageStatus` (`pending`, `done` ou `failed`), `customerId`, `assigneeId` (nulo até alguém assumir), `createdAt`, `updatedAt`.

Reply: `id`, `ticketId`, `authorId`, `body` (1 a 5000), `createdAt`.

Attachment: `id`, `ticketId`, `uploaderId`, `originalName`, `storedName`, `mimeType`, `sizeBytes`, `createdAt`.

`api/src/domain/ticket.ts` exporta os tipos de status, categoria, prioridade e triagem como uniões de strings literais (sem `enum` do TypeScript).

Regras:

- Cliente vê e opera só os próprios chamados; atendente e admin veem todos.
- Só cliente abre chamado. O chamado nasce `open`, com `triageStatus` `pending` e categoria e prioridade nulas.
- Atendente ou admin assume um chamado `open` ou `in_progress`: ele vira `in_progress`, com `assigneeId` igual a quem assumiu. Chamado `resolved` não pode ser assumido.
- Só quem assumiu, ou um admin, resolve, e só chamado `in_progress` pode ser resolvido.
- Respondem o cliente dono do chamado, atendentes e admins. Resposta do cliente em chamado `resolved` reabre o chamado (volta a `open`, mantendo o `assigneeId`).
- Anexos: até 5 MB, tipos `image/png`, `image/jpeg`, `application/pdf` e `text/plain`. Enviam o cliente dono, atendentes e admins; baixa quem pode ver o chamado. A pasta de anexos é criada se não existir.
- Sugestão de resposta por IA: só atendente e admin.
- Estatísticas: só admin.

## 5. Contrato HTTP

Prefixo `/api`, JSON, autenticação por `Authorization: Bearer <token>` (JWT com `sub` e `role`, validade de 8 horas). Erros sempre no formato `{"error":"<codigo>","message":"<texto>"}`. Ordem das verificações: `401 unauthorized` (sem token ou token inválido), `403 forbidden` (o papel não pode fazer a ação), `404 not_found` (inexistente ou chamado de outro cliente, para não revelar que existe), `403 forbidden` de novo quando o atendente não é quem assumiu, `422 validation_error` e, por último, `409` de transição.

| Método e rota | Quem | Sucesso | Erros específicos |
|---|---|---|---|
| `GET /api/health` | público | `200 {"status":"ok","db":"ok"}` | `503` se o banco não responde |
| `POST /api/auth/register` `{name,email,password}` | público | `201` usuário com `role` `customer` | `409 email_taken`; `422` senha com menos de 8 caracteres |
| `POST /api/auth/login` `{email,password}` | público | `200 {"token","user"}` | `401 invalid_credentials` |
| `GET /api/auth/me` | logado | `200` usuário | |
| `GET /api/tickets?status=&page=` | logado | `200 {"items","page","pageSize":20,"total"}`, mais recentes primeiro | |
| `POST /api/tickets` `{title,description}` | cliente | `201` chamado | `403` para atendente e admin |
| `GET /api/tickets/:id` | dono, atendente, admin | `200` chamado com `replies` e `attachments` | |
| `POST /api/tickets/:id/assign` | atendente, admin | `200` chamado | `409 invalid_transition` se `resolved` |
| `POST /api/tickets/:id/resolve` | quem assumiu, admin | `200` chamado | `409 invalid_transition` se não está `in_progress` |
| `POST /api/tickets/:id/replies` `{body}` | dono, atendente, admin | `201` resposta | |
| `POST /api/tickets/:id/attachments` (multipart, campo `file`) | dono, atendente, admin | `201` metadados | `413 file_too_large`; `415 unsupported_type` |
| `GET /api/attachments/:id/download` | quem vê o chamado | `200` com o arquivo, `Content-Type` e `Content-Disposition` | |
| `POST /api/tickets/:id/suggest-reply` | atendente, admin | `200 {"suggestion"}` | |
| `GET /api/stats` | admin | `200` no formato abaixo | |

Usuário serializado: `{"id","name","email","role"}`, nunca o hash. Chamado serializado: todos os campos da seção 4, com datas em ISO 8601.

```json
{
  "byStatus": { "open": 0, "in_progress": 0, "resolved": 0 },
  "byCategory": { "billing": 0, "technical": 0, "account": 0, "other": 0, "untriaged": 0 },
  "byPriority": { "low": 0, "medium": 0, "high": 0, "urgent": 0, "untriaged": 0 }
}
```

`untriaged` conta os chamados com categoria (ou prioridade) nula.

## 6. Triagem por IA e modo fake

A integração de IA fica em `api/src/integrations/ai-client.ts` e oferece duas operações: classificar um chamado (categoria e prioridade) e sugerir uma resposta. O modo vem de `AI_MODE`: `openai` usa o SDK com `OPENAI_API_KEY`; qualquer outro valor, inclusive ausente, usa o fake. O fake é o padrão e é determinístico:

- A comparação ignora maiúsculas e acentos e olha título e descrição juntos.
- Categoria, primeira regra que bater: `billing` se contém "fatura", "cobranca", "boleto", "pagamento" ou "reembolso"; `account` se contém "senha", "login", "acesso" ou "conta bloqueada"; `technical` se contém "erro", "bug", "falha", "nao funciona" ou "travou"; senão, `other`.
- Prioridade, primeira regra que bater: `urgent` se contém "urgente", "fora do ar" ou "parado"; `high` se contém "nao consigo" ou "bloquead"; `low` se contém "duvida" ou "sugestao"; senão, `medium`.
- Título contendo `[falha-ia]` faz a classificação lançar erro, para exercitar o caminho de falha.
- Sugestão fake: `Olá, {nome do cliente}! Recebemos o seu chamado "{título}" e a nossa equipe já está analisando.`

O worker (`api/src/jobs/triage-worker.ts`, iniciado por `npm run worker` dentro de `api/`) roda em loop a cada `TRIAGE_INTERVAL_MS` (padrão 2000): pega até 10 chamados com `triageStatus` `pending`, do mais antigo para o mais novo, classifica cada um e grava categoria, prioridade e `done`; em caso de erro, grava `failed`. Não há trava entre workers: dois workers no mesmo banco podem pegar o mesmo chamado.

## 7. Front

Telas em português, CSS simples:

- `/login` e `/register`.
- `/tickets`: lista (o cliente vê os seus; atendente e admin veem todos, com filtro por status).
- `/tickets/new`: formulário do cliente.
- `/tickets/:id`: status, categoria e prioridade (ou "Em triagem" enquanto `pending` e "Triagem falhou" se `failed`), conversa, formulário de resposta, anexos (enviar e baixar), botões Assumir e Resolver para o atendente e "Sugerir resposta", que preenche o campo de resposta.
- `/stats`: tabela de estatísticas, só para admin.

O token fica no `localStorage`. A URL da API vem de `import.meta.env.VITE_API_URL`, com padrão `http://localhost:4000`.

## 8. Seed

`api/prisma/seed.ts`, executado por `npm run seed` dentro de `api/`, cria três usuários e três chamados de exemplo, um em cada status:

| Papel | E-mail | Senha |
|---|---|---|
| admin | `admin@balcao.dev` | `Admin@123` |
| atendente | `agente@balcao.dev` | `Agente@123` |
| cliente | `cliente@balcao.dev` | `Cliente@123` |

## 9. Testes

- Unitários (`npm test` dentro de `api/`): Vitest, só `src/**/*.test.ts`. Pelo menos 10 testes de serviços com repositórios falsos e 6 das regras do classificador fake. Passam sem banco.
- Integração (`npm run test:integration` dentro de `api/`): `api/test/integration/*.test.ts`, repositórios contra um banco real em `DATABASE_URL_TEST`. Exigem criar o banco `balcao_test` e migrá-lo à mão, como o README explica.
- Caixa-preta (`npm test` dentro de `blackbox/`): Vitest com `fetch` contra `API_URL` (padrão `http://localhost:4000`), usando as contas da seed. Cobre todas as rotas e regras das seções 4 a 6: autenticação, permissões (inclusive o `404` de chamado alheio), ciclo do chamado, reabertura por resposta do cliente, triagem fake (consultando o chamado por até 15 segundos), sugestão fake, anexo enviado e baixado com os mesmos bytes, limites de tamanho e tipo e estatísticas comparadas antes e depois. Cada teste cria os próprios dados, com e-mails e títulos únicos, para a suíte rodar várias vezes seguidas contra o mesmo banco.

## 10. Como o legado sobe hoje

O README, em português, ensina a subir assim, sem nenhum script que automatize:

**1.** `docker compose up -d` (Postgres 16 na porta 5432, banco `balcao`, usuário e senha `balcao`).

**2.** `cd api && npm install && cp .env.example .env`.

**3.** `npx prisma migrate deploy && npm run seed`.

**4.** `npm run dev` (API na porta 4000).

**5.** Em outro terminal: `cd api && npm run worker`.

**6.** Em outro terminal: `cd web && npm install && npm run dev` (front na porta 5173).

**7.** Testes de integração: criar o banco `balcao_test` com `psql`, migrá-lo com `DATABASE_URL` apontando para ele e rodar `npm run test:integration`.

**8.** Caixa-preta: `cd blackbox && npm install && npm test`, com a API e o worker no ar.

Mais uma seção "Problemas comuns", com conselhos do tipo "se a porta 4000 estiver ocupada, mate o processo".

`api/.env.example`:

```
DATABASE_URL=postgresql://balcao:balcao@localhost:5432/balcao
DATABASE_URL_TEST=postgresql://balcao:balcao@localhost:5432/balcao_test
JWT_SECRET=dev-secret
AI_MODE=fake
OPENAI_API_KEY=
UPLOAD_DIR=/tmp/balcao/uploads
PORT=4000
TRIAGE_INTERVAL_MS=2000
```

## 11. Problemas plantados

Todos são requisito da base, e nenhum pode ter comentário, nome, mensagem de commit ou documentação que denuncie a intenção. O código precisa parecer escrito com pressa, não sabotado.

- P1. Env espalhado. `process.env` é lido direto em pelo menos seis arquivos fora de `api/src/config/`: `main.ts` (`PORT`, com 4000 de padrão), `http/middlewares/auth.ts` (`JWT_SECRET`, com `dev-secret` de padrão), `services/attachment-service.ts` (`UPLOAD_DIR`), `integrations/ai-client.ts` (`AI_MODE` e `OPENAI_API_KEY`), `jobs/triage-worker.ts` (`DATABASE_URL` e `TRIAGE_INTERVAL_MS`) e `http/routes/tickets.ts` (`AI_MODE`, na sugestão de resposta). `config/env.ts` existe, valida duas variáveis com zod, e só `repositories/prisma.ts` o usa. No front, `import.meta.env.VITE_API_URL` é lido em pelo menos três arquivos, sem módulo de configuração.
- P2. Rota falando com o banco. `http/routes/stats.ts` importa o client do Prisma e faz as agregações direto na rota; `http/routes/health.ts` roda `SELECT 1` direto pelo Prisma.
- P3. SDK de IA fora da integração. A rota de sugestão de resposta em `http/routes/tickets.ts` importa `openai`, instancia o client e repete ali mesmo a decisão do modo fake por `AI_MODE`, sem passar por `integrations/`.
- P4. Serviço dependente de HTTP. `services/attachment-service.ts` faz `import type { Request } from 'express'`, recebe o `req` inteiro para ler o arquivo enviado e lança `HttpError` de `http/errors.ts`; `services/ticket-service.ts` também importa e lança `HttpError`.
- P5. Import circular. `services/ticket-service.ts` importa `notifyAssignee` de `services/notification-service.ts`, que importa `formatTicketRef` de `ticket-service.ts`. O notification-service só escreve no console. Funciona em tempo de execução porque as funções importadas só são chamadas dentro de outras funções.
- P6. Código morto. `api/src/utils/legacy-sla.ts` não é importado por ninguém; `calculateSlaDeadline` é exportada em `services/ticket-service.ts` e nunca usada; `formatCurrency` é exportada em `web/src/utils/format.ts` e nunca usada; `lodash` está em `api/package.json` sem uso, e `axios` em `web/package.json` sem uso (o front usa `fetch`).
- P7. Portas e endereços fixos. API com 4000 de padrão; Vite com `port: 5173` e `strictPort: true`; Postgres na 5432 com o banco `balcao` fixo no compose e no `.env.example`; CORS da API liberado só para `http://localhost:5173`, escrito direto em `http/app.ts`; URL da API com padrão `http://localhost:4000` no front.
- P8. Worker e anexos compartilhados. O worker cria o próprio `PrismaClient` a partir de `DATABASE_URL`, sem nada que isole o banco por cópia do projeto; os anexos vão para o caminho absoluto `/tmp/balcao/uploads`, o mesmo para qualquer cópia.
- P9. Seed não idempotente. A seed usa `create`; rodar duas vezes falha por e-mail duplicado.
- P10. Front importando código do back. `web/src/pages/TicketDetailPage.tsx` e `web/src/api/tickets.ts` fazem `import type` de `../../../api/src/domain/ticket` para reaproveitar os tipos de status, categoria e prioridade.
- P11. `any` explícito em pelo menos cinco pontos da API (handlers e mapeamentos) e `console.log` como único log.
- P12. Ausências: nenhuma configuração de lint ou formatação, nenhum hook de git, nenhum script de checagem de tipos, nenhuma ferramenta de arquitetura (dependency-cruiser, knip, madge e afins), nenhum script ou Makefile que suba tudo, nenhum `AGENTS.md`.
- P13. Documentação de babá. O README da seção 10 e um `CLAUDE.md` longo (80 a 120 linhas), em português, com microgerenciamento ("sempre rode X antes de Y", "nunca use a porta 3000", "se der EADDRINUSE, use kill -9"), uma árvore de diretórios desatualizada (citando pastas que não existem, como `api/src/controllers/` e `web/src/store/`), um comando que não existe (`npm run migrate`) e duas instruções que se contradizem sobre onde ficam os testes.

## 12. O que não pode existir

- Qualquer pista de que os problemas são intencionais.
- Qualquer correção dos problemas da seção 11.
- Este arquivo, ou trechos dele, dentro de `balcao/`.
- Camadas, pastas, ferramentas ou scripts além dos descritos aqui.

## 13. Histórico

O repositório deve parecer ter crescido aos poucos: commits incrementais, um por pedaço de funcionalidade, com mensagens curtas e comuns (ex.: "add tickets", "upload de anexos", "stats page", "fix login"). Nada de commit único.

## 14. Validação da base

O que eu confiro quando você mandar o link:

- Seguindo o README à risca, numa máquina com Docker e Node 22, sobem a API (4000), o worker e o front (5173).
- `npm test` em `api/` passa; `npm run test:integration` passa depois do passo manual do README.
- `npx tsc --noEmit` passa em `api/` e em `web/`.
- `npm test` em `blackbox/` passa contra a API no ar, duas vezes seguidas.
- O front funciona com as três contas: abrir chamado, ver a triagem, responder, anexar, baixar, assumir, resolver, sugerir resposta e ver estatísticas.
- Cada problema de P1 a P13 está presente no lugar descrito, e nada da seção 12 existe.

## Instruções para o agente

Você vai construir o Balcão, a aplicação base de um desafio de curso sobre como preparar código legado para agentes de IA. Os alunos vão receber este código e instalar nele um harness (scripts de ambiente, gates determinísticos, hooks e documentação para agentes). Por isso a aplicação precisa funcionar de verdade e, ao mesmo tempo, conter exatamente os problemas da seção 11.

- Siga a estrutura da seção 3 e o contrato das seções 4 a 10 à risca.
- Os problemas da seção 11 são requisitos. Não os corrija, não os melhore e não deixe comentários, nomes ou mensagens que os denunciem.
- Não crie nada da seção 12 nem nada além do descrito.
- Faça commits incrementais, como na seção 13.
- Escreva o `CLAUDE.md` por último, depois de tudo validado, para que ele não atrapalhe o seu próprio trabalho.
- Não copie este arquivo, nem trechos dele, para dentro de `balcao/`.
- Ao terminar, rode a validação da seção 14 que estiver ao seu alcance (README à risca, testes unitários e de integração, `tsc --noEmit`, caixa-preta duas vezes) e reporte o resultado e qualquer desvio.
