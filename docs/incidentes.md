# Registro de incidentes

Erros reais de agentes observados durante a instalação do harness (04/10/2026). Cada entrada
diz o que aconteceu, que mudança no harness impede a repetição e o commit dessa mudança.
Agentes envolvidos: o agente principal (Claude Code) e dois subagentes em worktrees, um
corrigindo `api/` e outro `web/`, guiados pela saída dos gates.

## 1. `pkill -f` matou o shell do próprio agente

- **O que aconteceu:** para derrubar a API e o worker da primeira subida pelo README, o
  agente principal rodou `pkill -f "balcao/api.*tsx"; pkill -f "src/main.ts"; ...`. O padrão
  casou com a linha de comando do próprio shell que executava o `pkill`, e o comando morreu
  no meio (exit 144), sem chegar ao `docker compose down`. Com duas cópias no ar, o mesmo
  padrão derrubaria a API da outra cópia.
- **Mudança no harness:** `npm run down` (`scripts/down.mjs`). O `up` sobe cada processo
  como líder do próprio grupo e grava o PID em `.balcao/pids/`; o `down` encerra só esses
  grupos (`kill -<pgid>`). O `AGENTS.md` e o `docs/ambiente.md` proíbem matar por nome.
- **Commit:** `1b8811b` (subida e derrubada por cópia); regra no `AGENTS.md` em `0b22d5a`.

## 2. Config do dependency-cruiser que cegava três regras

- **O que aconteceu:** a primeira versão de `.dependency-cruiser.cjs`, escrita pelo agente
  principal, tinha `exclude: { path: 'node_modules' }`. Testada depois, ela some com as
  arestas para pacotes: G7 (`openai` na rota), R2 (`PrismaClient` no worker) e G6
  (`import type` de `express` no service) deixam de aparecer (20 violações viram 17), e o
  gate continua "rodando". Foi removida antes do primeiro uso por sorte, não por verificação.
- **Mudança no harness:** `npm run gates:autoteste` (`scripts/gates-autoteste.mjs`) planta uma
  violação de cada regra (G1..G10, R1, R2) e falha se alguma não aparecer na lista final
  com o ID e o arquivo. O `AGENTS.md` o torna obrigatório depois de mexer em config de gate.
- **Commit:** `7e3af1d`.

## 3. Lint da cópia principal varria as worktrees dos agentes

- **O que aconteceu:** com os subagentes trabalhando em `.claude/worktrees/`, dentro da
  pasta do repositório, `npm run gates` na cópia principal passou a acusar 101 violações
  falsas: o ESLint rodava sobre `.` e lintava o código em andamento dos outros agentes.
  Um agente guiado por essa saída tentaria "corrigir" arquivos de outra worktree.
- **Mudança no harness:** os gates lintam só `api` e `web` (caminhos explícitos), o
  `eslint.config.mjs` ignora `.claude/**` e o `.gitignore` ignora `.claude/`.
- **Commit:** `d35b5f7`.

## 4. Merge de duas branches verdes deixou a main vermelha, sem hook

- **O que aconteceu:** o agente de `web/` passou a declarar os próprios tipos e deixou de
  importar `TriageStatus` de `api/src/domain/ticket.ts`. O agente de `api/` não sabia disso.
  Cada branch passava nos gates; o merge das duas na branch principal gerou G10 (`TriageStatus`
  exportado sem uso). O merge foi feito sem nenhum gate, porque o git não roda `pre-commit`
  em commit de merge.
- **Mudança no harness:** `.githooks/pre-merge-commit`, que roda os mesmos gates do
  `pre-commit`; a violação foi corrigida no mesmo commit.
- **Commit:** `31ee3dc`.

## 5. Worktrees de agentes nasceram sem o harness

- **O que aconteceu:** as worktrees dos dois subagentes foram criadas a partir de
  `75bf996` (a base antiga), não do commit com os gates. Os dois tentaram ler o `AGENTS.md`
  e o `docs/gates.md`, não encontraram e só seguiram depois de um `git merge --ff-only` por
  conta própria. No commit deles, `core.hooksPath=.githooks` (configuração compartilhada
  entre worktrees) apontava para uma pasta que não existia naquela worktree, e o git
  ignorou o hook sem avisar.
- **Mudança no harness:** o `AGENTS.md` manda conferir, ao entrar numa worktree, que ela tem
  `scripts/gates.mjs` e, se não tiver, fazer o fast-forward antes de começar; os hooks
  agora estão versionados em `.githooks/` desde `31ee3dc`.
- **Commit:** `0b22d5a`.
