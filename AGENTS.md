# AGENTS.md

Porta de entrada para agentes no Balcão (central de chamados: API Express + Prisma,
worker de triagem e front React + Vite). Índice curto; o detalhe está em `docs/`.

## Gates

- `npm run gates`: roda todas as verificações e lista cada falha com ID e arquivo.
- `npm run gates -- G1 G2`: roda só as verificações desses IDs.
- Regras, ferramentas e como corrigir cada uma: `docs/gates.md`.
- Proibido esconder violação: nada de `eslint-disable`, `@ts-ignore`, `@ts-expect-error`,
  `@ts-nocheck`, nem tirar arquivo das configs (`eslint.config.mjs`, `knip.json`,
  `.dependency-cruiser.cjs`). Corrija o código.

## Regras de camada (api/src)

- `http/` (rotas, middlewares) chama `services/`; nunca `repositories/` nem `@prisma/client`.
- `services/` não conhece `express`, `multer` nem `http/`, nem por `import type`.
  Erros de negócio saem como erros de domínio; a tradução para HTTP fica em `http/`.
- Só `repositories/` (e `prisma/seed.ts`) usa o Prisma.
- O pacote `openai` só em `integrations/`.
- `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/`.
- Endereço fixo (`localhost`, portas, `/tmp/`) só em `config/`.
- `web/` não importa nada de `api/`, nem tipos: o contrato é o HTTP.
- Sem import circular, sem arquivo, export ou dependência sem uso.

## Pastas e entradas fixas (não renomear nem mover)

`api/src/main.ts`, `api/src/config/`, `api/src/domain/`, `api/src/http/`,
`api/src/services/`, `api/src/repositories/`, `api/src/integrations/`,
`api/src/jobs/triage-worker.ts`, `web/src/main.tsx`, testes em `api/src/**/*.test.ts`.

## Contrato

A API HTTP (rotas, corpos, status, códigos de erro) não muda. `blackbox/` é o contrato.
