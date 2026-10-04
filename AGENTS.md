# AGENTS.md

Porta de entrada para agentes no Balcão (chamados: API Express + Prisma, worker de triagem,
front React + Vite). Índice curto; o detalhe está nos arquivos citados.

## Ambiente (detalhe: `docs/ambiente.md`)

- `npm run up`: sobe esta cópia (deps, hook, Postgres, migrations, seed, API, worker, front)
  e imprime API, front, banco e pasta de anexos. Pode repetir sem derrubar.
- `npm run down`: derruba só o que o up desta cópia iniciou.
- Cada worktree é uma cópia com portas, banco e anexos próprios. Use os endereços que o up
  imprimiu; não assuma `4000`/`5173`. Logs em `.balcao/logs/`.
- Nunca `pkill -f`, `killall` ou `kill` por nome: casa com outras cópias e com o próprio shell.
- Worktree nova: confira que tem `scripts/gates.mjs`; se não tiver, nasceu de base velha:
  `git merge --ff-only <branch principal>` antes de começar.

## Gates (detalhe: `docs/gates.md`)

- `npm run gates`: todas as verificações; a lista final traz ID e arquivo.
- `npm run gates -- G1 G2`: só as desses IDs. O hook pre-commit/pre-merge-commit roda todas.
- `npm run gates:autoteste`: obrigatório depois de mexer em `eslint.config.mjs`, `knip.json`,
  `.dependency-cruiser.cjs` ou `scripts/gates.mjs`.
- Proibido esconder violação: `eslint-disable`, `@ts-ignore`, `@ts-expect-error`,
  `@ts-nocheck`, excluir arquivo das configs ou `--no-verify`. Corrija o código.

## Regras de camada (api/src)

- `http/` chama `services/`; nunca `repositories/` nem `@prisma/client`.
- `services/` não conhece `express`, `multer` nem `http/`, nem por `import type`: lança
  `DomainError` (`domain/errors.ts`); `http/errors.ts` traduz para status HTTP.
- Prisma só em `repositories/` (e `prisma/seed.ts`). `openai` só em `integrations/`.
- Ligação services ↔ repositórios ↔ config: `composition/services.ts`.
- `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/`.
- Endereço fixo (`localhost`, `/tmp/`) só em `config/`.
- `web/` não importa nada de `api/`, nem tipos: o contrato é o HTTP.
- Sem import circular; sem arquivo, export ou dependência sem uso.

## Fixos (não renomear nem mover)

`api/src/main.ts`, `api/src/config/`, `api/src/domain/`, `api/src/http/`,
`api/src/services/`, `api/src/repositories/`, `api/src/integrations/`,
`api/src/jobs/triage-worker.ts`, `web/src/main.tsx`, testes em `api/src/**/*.test.ts`.

## Contas da seed

admin `admin@balcao.dev` / `Admin@123` · atendente `agente@balcao.dev` / `Agente@123` ·
cliente `cliente@balcao.dev` / `Cliente@123`. A seed é idempotente.

## Contrato e testes

- A API HTTP (rotas, corpos, status, códigos de erro) não muda. `blackbox/` é o contrato:
  `cd blackbox && npm ci && API_URL=<API da cópia> npm test`.
- Unitários: `npm test` em `api/` (sem banco). IA fake por padrão (`AI_MODE` em `api/.env`).
- Errou algo que o harness devia ter impedido? Registre em `docs/incidentes.md`.
