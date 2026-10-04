# Balcão

Central de chamados. Clientes abrem chamados, uma IA faz a triagem (categoria e prioridade) em
segundo plano, atendentes assumem, respondem e resolvem, e o admin acompanha as estatísticas.

- `api/`: API em Express + Prisma + Postgres e o worker de triagem (processo separado).
- `web/`: front em React + Vite.
- `blackbox/`: testes caixa-preta da API (o contrato HTTP).
- `scripts/`: subida, derrubada, gates e autoteste dos gates.

Agentes de código: comecem pelo [AGENTS.md](AGENTS.md).

## Como rodar

**Pré-requisitos:** Linux ou macOS (no Windows, WSL), Git, Docker com `docker compose` e
Node.js 22 ou superior. Nada mais: o resto roda em container ou vem do `npm ci`.

```bash
npm run up      # sobe esta cópia inteira; pode repetir sem derrubar
npm run down    # derruba só o que o up desta cópia iniciou
npm run gates   # roda todas as verificações (G1..G10, R1, R2)
```

O `npm run up`, a partir de um clone limpo, instala as dependências, ativa o hook do Git,
sobe um Postgres só desta cópia, roda migrations e seed e coloca API, worker e front no ar.
No fim ele informa:

```
Balcão no ar nesta cópia: /caminho/da/copia
  API:     http://localhost:4000   (saúde: http://localhost:4000/api/health)
  Front:   http://localhost:5173
  Banco:   postgresql://balcao:balcao@localhost:5432/balcao_copia_a_1a2b3c   (container do projeto balcao-copia-a-1a2b3c)
  Anexos:  /caminho/da/copia/.balcao/uploads
  Worker:  pid 12345, IA em modo fake
  Logs:    /caminho/da/copia/.balcao/logs
```

Duas cópias rodam ao mesmo tempo (ex.: `git worktree add ../copia-b`, `cd ../copia-b`,
`npm run up`), cada uma com as suas portas, o seu banco, a sua pasta de anexos e o seu worker.
Detalhes em [docs/ambiente.md](docs/ambiente.md).

A IA roda em modo fake por padrão (`AI_MODE=fake` em `api/.env`), sem chave. Para a OpenAI,
coloque `AI_MODE=openai` e `OPENAI_API_KEY` em `api/.env` e rode `npm run up` de novo.

**Testes:** unitários com `npm test` em `api/` (também rodam nos gates). Caixa-preta, com a
cópia no ar: `cd blackbox && npm ci && API_URL=<API da cópia> npm test`.

## Contas da seed

| Papel | E-mail | Senha |
|---|---|---|
| admin | `admin@balcao.dev` | `Admin@123` |
| atendente | `agente@balcao.dev` | `Agente@123` |
| cliente | `cliente@balcao.dev` | `Cliente@123` |

## Gates

`npm run gates` roda todas as verificações, mesmo quando uma falha, e termina com a lista
`ID arquivo detalhe` e código 1 se algo falhou. `npm run gates -- G1 G2` roda só as
verificações desses IDs. O hook `pre-commit` (`.githooks/pre-commit`, ativado pelo `up`)
roda os gates e bloqueia o commit quando falham.

| ID | Regra | Ferramenta |
|---|---|---|
| G1 | Zero erro de tipo em `api/` e `web/` | `tsc --noEmit` de cada pacote |
| G2 | Lint sem erro e sem warning (`any` explícito, variável e import sem uso) | ESLint + typescript-eslint, `--max-warnings 0` |
| G3 | Testes unitários `api/src/**/*.test.ts` passam | Vitest |
| G4 | `api/src/http/` não importa `@prisma/client` nem `api/src/repositories/` | dependency-cruiser |
| G5 | `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/` | ESLint (`no-restricted-syntax`) |
| G6 | `api/src/services/` não importa `express`, `multer` nem `api/src/http/` (nem por tipo) | dependency-cruiser (`tsPreCompilationDeps`) |
| G7 | `openai` só em `api/src/integrations/` | dependency-cruiser |
| G8 | `web/` não importa nada de `api/` (nem por tipo) | dependency-cruiser (`tsPreCompilationDeps`) |
| G9 | Nenhum import circular em `api/src/` e `web/src/` | dependency-cruiser (`circular`) |
| G10 | Nenhum arquivo, export (inclusive tipo) ou dependência sem uso em `api/` e `web/` | knip |
| R1 | Nenhum endereço fixo (`localhost`, `127.0.0.1`, `/tmp/`) fora de `config/` | ESLint (`no-restricted-syntax`) |
| R2 | `@prisma/client` só em `api/src/repositories/` (e na seed) | dependency-cruiser |

**Regras próprias.** R1 existe porque o Balcão tinha endereço fixo dos dois lados (CORS
preso em `localhost:5173`, front com `localhost:4000` repetido em três arquivos, anexos em
`/tmp/balcao/uploads` para todas as cópias), e cada um vira conflito quando a segunda cópia
sobe. R2 existe porque o worker criava o próprio `PrismaClient` lendo `process.env` direto,
fora da camada de repositórios e da configuração da cópia; G4 só protege `http/`.

Para aplicar o exemplo de violação de cada regra própria:

```bash
git apply harness/violacoes/R1-endereco-fixo.patch && npm run gates      # falha com R1
git apply -R harness/violacoes/R1-endereco-fixo.patch
git apply harness/violacoes/R2-prisma-fora-de-repositories.patch && npm run gates   # falha com R2
git apply -R harness/violacoes/R2-prisma-fora-de-repositories.patch
```

`npm run gates:autoteste` planta uma violação de cada regra (G1..G10, R1, R2), uma de cada
vez, e confere que os gates acusam o ID e o arquivo. Rode depois de mexer em config de gate.
Detalhes em [docs/gates.md](docs/gates.md).

## Decisões

**Isolamento das cópias.** O Balcão tinha endereço fixo em todo lugar: Postgres na 5432,
API na 4000, Vite na 5173 com `strictPort`, CORS preso em `http://localhost:5173`, front com
`localhost:4000` repetido em três arquivos e anexos em `/tmp/balcao/uploads`. Agora cada cópia
ganha um slot N (API `4000+N`, front `5173+N`, Postgres `5432+N`), registrado na pasta comum do
git para que as worktrees de um clone nunca disputem o mesmo slot. Cada cópia tem um projeto
`docker compose` próprio (container, volume e banco `balcao_<pasta>_<hash>`), anexos em
`<cópia>/.balcao/uploads` e processos com PID registrado em `.balcao/pids/`. O `up` passa
`WEB_ORIGIN` para a API (CORS) e `VITE_API_URL` para o front de cada cópia. A seed passou a
ser idempotente (upsert das contas, chamados de exemplo só se ainda não existem), porque
quebrava com "Unique constraint failed" na segunda subida. O `npm ci` respeita os lockfiles.

**Como as violações existentes foram corrigidas.** As regras vieram primeiro (commit dos
gates com o código ainda vermelho). Depois, dois agentes, um em `api/` e outro em `web/`,
cada um na sua worktree, corrigiram o código guiados pela saída dos gates:

- A config da API (`api/src/config/env.ts`) virou o único leitor de `process.env`, com
  padrões (IA `fake`, `JWT_SECRET`, `UPLOAD_DIR`, `PORT`, `WEB_ORIGIN`).
- As rotas viraram fábricas que recebem services. A ligação com repositórios, IA e config
  fica em `api/src/composition/services.ts`, fora de `http/` (G4).
- Health, stats, `/me` e sugestão de resposta ganharam services e repositórios próprios.
- Os services lançam `DomainError` (`api/src/domain/errors.ts`), e `http/errors.ts` traduz
  para o mesmo status e código de antes (G6).
- O upload recebe o arquivo, e não o `Request` do Express.
- O SDK `openai` saiu da rota de sugestão e foi para `integrations/ai-client.ts`, com o mesmo
  prompt (G7).
- O worker usa o repositório e a config, sem `PrismaClient` próprio (R2).
- O ciclo `notification-service` ↔ `ticket-service` sumiu: `formatTicketRef` foi para
  `domain/` (G9).
- O front declara os próprios tipos do contrato HTTP (G8) e lê a URL da API só de
  `web/src/config/` (G5, R1).
- Saíram o código morto (`utils/legacy-sla.ts`, `calculateSlaDeadline`, `formatCurrency`),
  os exports sem uso e as dependências `lodash` e `axios` (G10).
- Os `any` viraram tipos de verdade ou `unknown` (G2).
- A suíte caixa-preta passou antes e depois, 51/51.

**O que mudou na documentação para agentes.** O `CLAUDE.md` antigo mentia: mandava rodar
`npm run migrate`, que não existe, citava `api/src/controllers/`, `api/tests/` e
`web/src/store/`, que não existem, mandava usar axios (o front usa `fetch`), mandava usar `any`
"para não travar a entrega" e `kill -9` em porta ocupada, e se contradizia sobre onde ficam os
testes. Ele virou um ponteiro para o `AGENTS.md`. O `AGENTS.md` (menos de 60 linhas) é um
índice: subir, derrubar, gates, contas da seed, regras de camada e onde está o detalhe
(`docs/ambiente.md`, `docs/gates.md`, `docs/incidentes.md`). Cada linha nova dele veio de um
erro observado (ver o registro de incidentes). Tudo que é verificável mecanicamente virou
gate, e não frase no documento.

## Registro de incidentes

[docs/incidentes.md](docs/incidentes.md): erros reais de agentes durante a instalação do
harness e a mudança no harness que impede cada um de se repetir.
