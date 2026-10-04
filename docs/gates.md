# Gates

`npm run gates` (na raiz) roda todas as verificações, mesmo quando uma falha, e termina
com a lista `ID arquivo detalhe` e código de saída 1 se algo falhou. `npm run gates -- G1 G2`
roda só as verificações desses IDs. O hook `pre-commit` (`.githooks/pre-commit`) roda os gates
antes de cada commit.

| ID | Regra | Ferramenta | Onde configura |
|---|---|---|---|
| G1 | Zero erro de tipo em `api/` e `web/` | `tsc --noEmit` de cada pacote | `api/tsconfig.json`, `web/tsconfig.json` |
| G2 | Lint sem erro e sem warning (`any` explícito, variável e import sem uso, recomendadas) | ESLint + typescript-eslint, `--max-warnings 0` | `eslint.config.mjs` |
| G3 | Testes unitários `api/src/**/*.test.ts` passam | Vitest | `api/vitest.config.mts` |
| G4 | `api/src/http/` não importa `@prisma/client` nem `api/src/repositories/` | dependency-cruiser | `.dependency-cruiser.cjs` |
| G5 | `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/` | ESLint `no-restricted-syntax` | `eslint.config.mjs` |
| G6 | `api/src/services/` não importa `express`, `multer` nem `api/src/http/`, nem por `import type` | dependency-cruiser | `.dependency-cruiser.cjs` |
| G7 | `openai` só é importado em `api/src/integrations/` | dependency-cruiser | `.dependency-cruiser.cjs` |
| G8 | Nada em `web/` importa de `api/`, nem por `import type` | dependency-cruiser | `.dependency-cruiser.cjs` |
| G9 | Nenhum import circular em `api/src/` e `web/src/` | dependency-cruiser (`circular`) | `.dependency-cruiser.cjs` |
| G10 | Nenhum arquivo, export (inclusive tipo) ou dependência sem uso em `api/` e `web/` | knip | `knip.json` |
| R1 | Nenhum endereço fixo (`localhost`, `127.0.0.1`, `/tmp/`) fora de `config/` | ESLint `no-restricted-syntax` | `eslint.config.mjs` |
| R2 | `@prisma/client` só em `api/src/repositories/` (e na seed) | dependency-cruiser | `.dependency-cruiser.cjs` |

## Imports só de tipo (G6 e G8)

O TypeScript apaga `import type` na compilação, e por padrão o dependency-cruiser analisa o
que sobra. Com `tsPreCompilationDeps: true` ele lê o fonte antes da compilação e enxerga
também os imports só de tipo. Sem essa opção, `import type { Request } from 'express'` num
service passaria.

## Regras próprias

### R1: nada de endereço fixo fora de `config/`

**Motivação.** O Balcão foi escrito como se fosse a única cópia no mundo: CORS preso em
`http://localhost:5173`, front com `|| 'http://localhost:4000'` repetido em três arquivos,
anexos em `/tmp/balcao/uploads` para todo mundo. Com duas worktrees, cada endereço fixo vira
conflito: um front fala com a API da outra cópia, as duas gravam anexos na mesma pasta.
Endereço é configuração de cada cópia, e a configuração mora em `config/`.

**Exemplo de violação:** `harness/violacoes/R1-endereco-fixo.patch`.

### R2: o Prisma só em `repositories/`

**Motivação.** O worker de triagem criava o próprio `PrismaClient` lendo `process.env`
direto, fora da camada de repositórios e da configuração. Qualquer arquivo que crie um
cliente de banco por conta própria pode apontar para o banco errado quando a cópia muda de
porta e de banco. G4 só protege `http/`; R2 fecha o resto de `api/src/` (services, jobs,
integrations, domain).

**Exemplo de violação:** `harness/violacoes/R2-prisma-fora-de-repositories.patch`.

### Como aplicar um exemplo

```bash
git apply harness/violacoes/R1-endereco-fixo.patch
npm run gates            # falha com R1 e o arquivo
git apply -R harness/violacoes/R1-endereco-fixo.patch
```
