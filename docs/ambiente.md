# Ambiente por cópia

Cada cópia do Balcão (um clone ou uma `git worktree`) sobe isolada das outras: portas, banco,
pasta de anexos, worker e front próprios. Tudo vem de dois comandos, na raiz da cópia:

```bash
npm run up      # sobe ou confirma que está no ar; pode rodar de novo sem derrubar
npm run down    # derruba só o que o up desta cópia iniciou (dados ficam no volume)
npm run down -- --limpar   # derruba e apaga banco e anexos desta cópia
```

## O que o `up` faz

1. Confere Node 22+ e Docker.
2. Escolhe o slot da cópia (abaixo) e grava o estado em `.balcao/state.json`.
3. `npm ci` na raiz, em `api/` e em `web/` quando o lockfile mudou desde a última instalação
   (`npm ci` respeita o lockfile; `npm install` reescreve metadados dele).
4. Ativa o hook: `git config core.hooksPath .githooks`.
5. Sobe o Postgres da cópia: `docker compose -p <projeto>`, com porta e banco próprios
   (`BALCAO_DB_PORT`, `BALCAO_DB_NAME`), e espera o healthcheck.
6. Escreve `api/.env` com os valores da cópia (`DATABASE_URL`, `PORT`, `UPLOAD_DIR`,
   `WEB_ORIGIN`) e preserva o resto (ex.: `AI_MODE`, `OPENAI_API_KEY`).
7. `prisma generate`, `prisma migrate deploy` e a seed (idempotente: upsert das contas).
8. Sobe API (`npm run dev`), worker (`npm run worker`) e front (`npm run dev` com `WEB_PORT`
   e `VITE_API_URL`), cada um líder do próprio grupo de processos, PID em `.balcao/pids/`,
   log em `.balcao/logs/`. Processo já no ar é mantido.
9. Espera `/api/health`, a linha de início do worker e o front responderem, e imprime API,
   front, banco, pasta de anexos, PID do worker e modo da IA.

## Slots e portas

Slot N usa API `4000+N`, front `5173+N` e Postgres `5432+N` (só em `127.0.0.1`). O slot de
cada cópia fica registrado em `<git-common-dir>/balcao-copias.json`, visível a todas as
worktrees do clone, e no `.balcao/state.json` da cópia. Uma cópia nova pega o menor slot
que não é de outra cópia e cujas três portas estão livres. Assim a cópia derrubada não perde
as portas para outra que suba depois.

Nome do projeto Docker: `balcao-<pasta>-<hash>`; banco: `balcao_<pasta>_<hash>`; anexos:
`<cópia>/.balcao/uploads`. O hash vem do caminho absoluto da cópia.

## Derrubar

`npm run down` manda SIGTERM (e SIGKILL depois de 5 s) para o grupo de cada PID registrado e
faz `docker compose -p <projeto> down`. Nunca derrube por nome (`pkill -f`, `killall`): o
padrão casa com processos de outras cópias e até com o próprio shell (incidente 1).

## Problemas comuns

- **"a porta X está ocupada por um processo que não é desta cópia"**: algo de fora pegou a
  porta do slot. Veja com `lsof -i :X`. Não mate processos de outras cópias.
- **Algo não sobe**: o `up` mostra as últimas linhas do log; o completo está em `.balcao/logs/`.
- **Começar do zero**: `npm run down -- --limpar` e `npm run up`.
- **Variáveis de ambiente**: só em `api/src/config/` e `web/src/config/` (G5).
