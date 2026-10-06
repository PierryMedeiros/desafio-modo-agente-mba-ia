# Feedback do desafio 2: "Balcão: domando um legado para agentes"

Execução retomada em 04/10/2026, depois da queda de luz, por Claude Code (Opus 5.5) com dois
subagentes em worktrees. Entrega: repositório local `balcao/`, branch `main` (sem push).

## Contradições e incoerências do enunciado

1. **Placeholders que viraram critério.** "Esforço de referência: XX horas (placeholder,
   calibrado após a execução de referência)", "um `AGENTS.md` na raiz, com no máximo XX
   linhas" e "`wc -l AGENTS.md` dá no máximo XX". O critério de aceite não tem número. Usei
   60 por instrução externa ao enunciado.
2. **Repositório base inexistente.** "Repositório base: https://github.com/devfullcycle/REPO-A-DEFINIR".
   O Fluxo do avaliador depende de `$BASE` (passo 4), que não está definido no texto.
3. **"Não é para reescrever o sistema" contra G4 e G6.** O texto diz "Você muda o código o
   necessário para ele respeitar as regras do harness, e mais nada". Mas G4 (rota sem
   repositório) e G6 (service sem `http/`, nem por tipo) exigem uma raiz de composição, erros
   de domínio com tradução para HTTP, três services novos e rotas virando fábricas. O mínimo
   necessário já é uma refatoração de camadas, e o diff de `api/src` passou de mil linhas.
4. **"Nenhum arquivo fica fora das verificações" contra G5.** O critério diz "nenhum arquivo
   dessas pastas fica fora das verificações". Mas G5 ("`process.env` só aparece em
   `api/src/config/`") obriga a regra a não valer em `config/`. Qualquer ferramenta vai ter um
   `ignores: ['api/src/config/**']` no bloco dessa regra, e o avaliador do passo 8 ("confira,
   nas configurações das ferramentas, que nenhum arquivo [...] foi excluído") vai encontrá-lo.
   Resolvi com um comentário explicando que o arquivo continua no lint geral.
5. **Exemplo versionado contra "nenhum arquivo fora das verificações".** O texto pede "um exemplo
   de violação versionado que, aplicado, faz os gates falharem". Se o exemplo for um `.ts`
   dentro de `api/src`, a `main` deixa de passar. Se ficar fora, alguém pode ler isso como
   exclusão. Usei patches em `harness/violacoes/` (`git apply`), mas o enunciado não sugere
   formato nenhum.
6. **Pastas fixas do front.** O passo 5 diz que as violações são plantadas "sempre em arquivos
   novos dentro das pastas fixas". Para o `web/`, porém, a lista de fixos só tem um arquivo
   (`web/src/main.tsx`), não uma pasta. G5 (`import.meta.env`), G8 e G9 do front ficam sem
   lugar definido para a violação.
7. **Estrutura incompleta.** "O Balcão hoje" lista as pastas de `api/src/` sem `utils/`, mas o
   repositório tem `api/src/utils/legacy-sla.ts`. É a armadilha do G10, mas o mapa não bate
   com o disco.
8. **Branch.** O texto pede "tudo na branch `main`", mas o repositório base vem na branch
   `base-balcao`. Renomeei.
9. **Dois prompts para a mesma função.** O texto diz que "o modo `openai` continua compilando"
   e "nenhuma mudança de comportamento". Mas a base tinha dois prompts de sistema diferentes
   para sugerir resposta: o da rota, que era o usado, e o do `ai-client`, que não era usado.
   G7 obriga a unificar, e o enunciado não diz qual vale.

## Pontos vagos em que precisei adivinhar

- **"O banco" diferente entre cópias:** nome do banco, container ou porta? Fiz os três
  (banco `balcao_<pasta>_<hash>`, projeto compose próprio, porta `5432+N`).
- **"Derrubar encerra tudo que a subida iniciou":** inclui apagar o volume? Decidi parar o
  container e manter os dados, com `npm run down -- --limpar` para apagar.
- **Onde fica a pasta de anexos:** escolhi `<cópia>/.balcao/uploads`, ignorada pelo git.
- **G2 "sem warning":** com qual conjunto de regras? Usei `js.recommended` +
  `typescript-eslint` recommended.
- **G10 "dependência declarada sem uso em `api/` e em `web/`":** vale também para o
  `package.json` de ferramentas na raiz? Incluí.
- **Hook:** roda todos os gates ou só tipo e lint? Sobre o *stage* ou a árvore de trabalho?
  Roda todos, na árvore de trabalho, porque levam cerca de 5 s.
- **"Todo comando citado no `AGENTS.md` funciona":** comando com placeholder
  (`API_URL=<API da cópia>`, `<branch principal>`) conta?
- **"Erros reais de agente":** o agente principal conta, ou só subagentes? Registrei os dois.
- **"Abra o front e entre com o cliente":** a verificação é manual, por navegador. Usei um
  Chromium headless (Playwright em cache na máquina) para provar.
- **Seed idempotente:** se alguém alterou uma conta da seed, a subida deve restaurá-la? Optei
  por não sobrescrever (`upsert` com `update: {}`).

## Travas: o que bloqueou e quanto custou

| Trava | Custo |
|---|---|
| `pkill -f` casou com o próprio shell e matou o comando no meio (incidente 1) | ~1 min |
| Config do dependency-cruiser com `exclude: node_modules` que escondia G6, G7 e R2 (incidente 2); descoberta ao testar a hipótese | ~3 min, mais o autoteste |
| Hook ativo bloqueando os commits do próprio harness enquanto a `main` estava vermelha: tive de ordenar os commits para depois do merge dos agentes, sem usar `--no-verify` | ~2 min de reorganização |
| Worktrees dos subagentes criadas a partir da base antiga, sem harness (incidente 5); os agentes resolveram sozinhos com fast-forward | ~1 min de cada agente |
| ESLint da cópia principal varrendo as worktrees aninhadas em `.claude/` (101 falsos positivos, incidente 3) | ~2 min |
| Merge de duas branches verdes gerando `main` vermelha sem hook (incidente 4) | ~2 min |
| Sem navegador instalado para o passo "entre pelo front" | ~3 min (achei o Chromium do Playwright em cache) |
| Na verificação do passo 9, `ps \| grep copia-b` contou o próprio shell (a mesma armadilha do incidente 1) | ~1 min |

## O que pesquisei e decidi por conta própria

- **knip** aceita workspaces que não estão no `workspaces` do `package.json` raiz, declarados no
  `knip.json`. Assim não precisei transformar o repositório em monorepo npm nem mexer nos
  lockfiles de `api/` e `web/` (Context7, documentação do knip).
- **dependency-cruiser** só enxerga `import type` com `tsPreCompilationDeps: true` (G6 e G8).
  Confirmei na documentação e testei com amostra. Também descobri, por teste, que `exclude`
  de `node_modules` some com as arestas para pacotes.
- **G5 e R1** com ESLint `no-restricted-syntax` (seletores AST para `process.env`,
  `import.meta.env` e literais com `localhost`/`/tmp/`), mais `noInlineConfig: true`, que
  neutraliza qualquer `eslint-disable`.
- **Saída dos gates:** cada ferramenta em JSON, com o ID tirado do prefixo da mensagem (ESLint)
  ou do nome da regra (dependency-cruiser).
- **Scripts em Node** (`.mjs`) em vez de bash, pela portabilidade para macOS: bash 3.2, sem
  `setsid` e sem `sha1sum`. Os processos sobem com `detached` (grupo próprio) e descem pelo
  grupo.
- **Slots de porta** (`4000+N`, `5173+N`, `5432+N`) registrados em
  `<git-common-dir>/balcao-copias.json`, visíveis a todas as worktrees do clone, com sondagem de
  porta livre.
- **`npm ci` só quando o lockfile mudou**, por causa da dica sobre o `npm install` reescrever
  lockfiles. Postgres preso em `127.0.0.1`.
- **Hook `pre-merge-commit`**, além do `pre-commit`.
- **Autoteste dos gates** (`npm run gates:autoteste`), que planta uma amostra por regra.
- **Regras próprias:** R1 (endereço fixo fora de `config/`) e R2 (Prisma só em
  `repositories/`).
- **Divisão do trabalho:** escrevi as regras primeiro e commitei com a `main` vermelha. Depois,
  dois subagentes em worktrees paralelas, um para `api/` e outro para `web/`, corrigiram guiados
  pela saída dos gates, enquanto eu escrevia os scripts de ambiente.

## Onde o enunciado decidiu por mim sem necessidade

- **A forma do registro de incidentes:** "o hash do commit dessa mudança" obriga a granularidade
  dos commits. Tive de separar cada correção de harness num commit próprio para ter um hash
  por incidente.
- **"Export sem uso (inclusive de tipo)":** obriga a desexportar classes `Prisma*Repository` e
  tipos usados só no próprio arquivo. É estilo, não protege o harness de nada.
- **`web/src/config/` como único lugar de `import.meta.env`:** a pasta não existia. O
  enunciado fixa o nome da pasta, quando bastaria fixar a regra ("um único módulo").
- **O limite de linhas do `AGENTS.md` como número fixo:** a qualidade do índice importa mais.
- **O `CLAUDE.md` "sai de cena e passa a apontar para o `AGENTS.md`":** a decisão de manter os
  dois arquivos poderia ficar com o aluno.

## Critérios de aceite que não dá para verificar como estão escritos

- "O `AGENTS.md` [...] tem no máximo XX linhas": não há número.
- "Nenhuma violação foi escondida [...] nenhum arquivo dessas pastas fica fora das
  verificações": entra em conflito com o escopo inevitável de G5 (item 4 das contradições) e
  depende de leitura subjetiva das configs.
- "O registro de incidentes tem pelo menos três entradas" de "erros reais de agente": "real"
  não é verificável. O critério só confere que o hash existe e mexe no harness.
- "A API funcionando exatamente como antes": só é verificável até onde a caixa-preta cobre.
  Logs, mensagens de inicialização e casos que a suíte não exercita (JWT sem `sub`, por
  exemplo) ficam de fora.
- "O login pelo front funciona nas duas": exige navegador e operação manual. Não há critério
  objetivo.
- "Todo comando citado no `AGENTS.md` funciona": comandos com placeholder ficam indefinidos.
- "Em até 15 segundos [...] troca 'Em triagem'": depende da máquina, e o front só consulta a
  cada 3 s.
- "Commit que mexe no harness": o texto não define o que é harness. Documento conta? E
  correção de código para passar nos gates?

## Resultado de cada passo do Fluxo do avaliador

Executado num clone novo do repositório (`copia-a`) e numa worktree (`copia-b`), em pastas
vazias do scratchpad, com a cópia principal derrubada.

| Passo | Resultado |
|---|---|
| 1. Clone, subida, nova subida, login | **Passou.** Subida a partir do clone limpo em 20 s. Informou API `:4000`, front `:5173`, banco `postgresql://…:5432/balcao_copia_a_b98595` e anexos `copia-a/.balcao/uploads`. A segunda subida, sem derrubar, saiu com 0, seed sem duplicar ("já está no ar" nos três processos) e hook ativo (`core.hooksPath=.githooks`). Login do cliente pelo navegador (Chromium headless) caiu em "Meus chamados". |
| 2. `git worktree add ../copia-b` e subida | **Passou.** API `:4001`, front `:5174`, banco `:5433/balcao_copia_b_75bf09`, anexos `copia-b/.balcao/uploads`. |
| 3. Chamado, triagem, anexo e isolamento | **Passou.** "Fatura em dobro, urgente" na A: "Em triagem" virou "Financeiro / prioridade Urgente" em 3,3 s. O `.txt` anexado apareceu só na pasta da A (a B ficou com 0 arquivos). A lista da B não mostrou o chamado. O chamado aberto na B foi triado em 3,3 s e o anexo dela foi para a pasta da B. |
| 4. Caixa-preta do repositório base nas duas | **Passou.** 51/51 contra `:4000` e 51/51 contra `:4001`, sem `OPENAI_API_KEY`. |
| 5. Gates e violações plantadas | **Passou.** Na `main`: "Gates: tudo passou". Plantei 12 violações, uma por vez em arquivos novos nas pastas fixas: G1 (`domain`), G2 (import sem uso no web), G3 (teste falhando em `integrations`), G4 (rota importando repositório), G5 nos dois lados, G6 (`import type` de `multer` e import de `http/errors`), G7 (`import type` de `openai/resources` em `jobs`), G8 (`import type` de `api/` no web), G9 (ciclo no web) e G10 (componente sem uso). Todas falharam com o ID e o arquivo na lista final e quase todas trouxeram também G10. O `npm run gates:autoteste` repetiu o exercício com outras 15 amostras: todas acusadas. |
| 6. Exemplos das regras próprias | **Passou.** Os patches R1 e R2 falham com "R1 api/src/services/exemplo-r1.ts" e "R2 api/src/jobs/exemplo-r2.ts" (mais G10) e são revertidos com `git apply -R`. |
| 7. Hook | **Passou.** Os dois commits do enunciado (erro de tipo e variável sem uso) foram bloqueados ("Commit bloqueado pelos gates") e o HEAD não andou. O `.githooks/pre-commit` lista G1 (tipos) e G2 (lint) explicitamente. |
| 8. Supressões e exclusões | **Passou, com ressalva.** O `git grep` não encontrou nada. Nas configs, os únicos `ignores` que tocam `api/src` ou `web/src` são `config/**` nos blocos de G5 e R1, que é a definição dessas regras; os arquivos continuam no lint geral, e há um comentário explicando isso. |
| 9. Derrubar a B, A no ar, subir a B, derrubar as duas | **Passou.** Derrubar a B encerrou os três grupos de processos e o container dela; a A continuou respondendo `{"status":"ok","db":"ok"}` e o container da A seguiu de pé. A B subiu de novo nas mesmas portas. As duas derrubadas não deixaram processo nem container. |
| 10. Documentação | **Passou.** `wc -l AGENTS.md` dá 54. O `CLAUDE.md` aponta para o `AGENTS.md` (link e `@AGENTS.md`). Os caminhos citados existem e os comandos rodaram. `git show --stat` dos 5 hashes do registro (`1b8811b`, `7e3af1d`, `d35b5f7`, `31ee3dc`, `0b22d5a`) mostra commits de harness. O README tem as cinco seções. |
| 11. Pastas e entradas fixas | **Passou.** O `ls -d` listou as nove. |

## Tempo, custo e tamanho

- **Antes da queda:** nada da sessão anterior chegou ao disco. O reflog só tem o `clone` (pasta
  criada em 03/10 às 15:29). Os 18 commits de 03/10, entre 13:14 e 13:29, são do repositório
  base, não do trabalho do desafio, e não havia arquivo novo, branch, stash nem container do
  Balcão. Tempo aproveitável antes da queda, pelo histórico: **0 min**. O tempo gasto antes
  não é mensurável.
- **Depois da queda:** de 04/10 09:35 (primeiro comando) até cerca de 10:10 (feedback escrito),
  **cerca de 35 min**. O primeiro commit do desafio é das 09:42 e o último das 10:03. Os
  subagentes trabalharam em paralelo: API cerca de 9,5 min, front cerca de 3,5 min.
- **Total:** cerca de 35 min.
- **Custo da sessão (`/cost`):** o agente não consegue executar comandos de barra. Rode `/cost`
  nesta sessão e anote aqui: ______.
- **`AGENTS.md`:** 54 linhas (limite usado: 60).

## Retomar depois da queda: o que foi fácil e o que foi difícil

**Fácil**

- O disco não mentia. `git log`, `git status`, `git reflog` (só o clone), `git worktree list`,
  `docker ps` e `ps` mostraram em menos de um minuto que nada tinha sido feito: o "onde parei"
  era o começo.
- O enunciado é autocontido, e a base subiu de primeira pelo README, com 51/51 na caixa-preta,
  o que deu uma linha de base confiável.

**Difícil**

- O pedido dizia que a sessão "estava fazendo o desafio", mas o disco mostrava zero
  progresso. Precisei decidir entre confiar no relato e confiar no disco. Confiei no disco,
  mas fica a dúvida de que algo tenha se perdido sem rastro, como raciocínio e decisões que só
  existiam no contexto.
- Os commits da base têm o mesmo autor do aluno, o que confunde a leitura "o que é meu e o que
  é da base". Só a mensagem e o horário (antes do clone) separam as duas coisas.
- O `CLAUDE.md` antigo, que mente, foi injetado no meu contexto no início da sessão e também no
  contexto dos subagentes, mesmo depois de eu tê-lo trocado por um ponteiro. Um dos subagentes
  relatou ter visto as instruções antigas (`npm install`, `any`, `kill -9`). Mudar a
  documentação não alcança sessões já abertas, e depois de uma queda a sessão retomada carrega o
  documento antigo. Isso não virou incidente com commit porque não há mudança de harness
  possível do lado do repositório, mas é o risco mais sério da retomada.
- Os processos e containers da sessão anterior poderiam estar órfãos. Aqui não estavam, mas não
  existia nenhum registro de PID para conferir com segurança. Hoje o harness grava esses PIDs
  em `.balcao/pids/`, e numa próxima queda o `npm run down` resolve sem adivinhação.
