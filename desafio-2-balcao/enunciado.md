Projeto: MBA em Engenharia de Software com IA
Fase do projeto: Desenvolvimento em modo agente, desafio 2

# Balcão: domando um legado para agentes

O Balcão é a central de chamados da empresa: clientes abrem chamados, uma IA faz a triagem em segundo plano, atendentes respondem e o admin acompanha os números. Funciona. Foi construído às pressas, por várias mãos e vários agentes, sem revisão, e agora o time quer trabalhar nele do jeito que o módulo ensina: vários agentes ao mesmo tempo, cada um na sua worktree, com gates e documentação que os guiem.

A primeira tentativa durou uma manhã. Duas cópias do projeto não sobem juntas, o README pede seis passos em três terminais, o `CLAUDE.md` manda rodar um comando que não existe e cada agente que entra no código aprende com o que vê: variável de ambiente lida em qualquer lugar, rota falando direto com o banco, serviço que conhece o Express.

Você vai instalar o harness do Balcão. Não é para reescrever o sistema do zero nem criar feature: é para que qualquer agente consiga subir o ambiente, mexer no código e provar que não quebrou nada, sem ninguém do lado. A tensão é a de todo legado: o harness codifica regras que o código de hoje ainda não respeita, e fazer o código passar a respeitá-las é parte do trabalho.

## Objetivo

Entregar, num fork público do repositório base:

- um comando que sobe o Balcão inteiro a partir de um clone limpo, e outro que derruba;
- duas cópias do projeto (worktrees) rodando ao mesmo tempo, sem dividir porta, banco, anexos nem worker;
- um comando de gates que barra as dez invariantes deste enunciado e pelo menos duas regras suas, com o código passando em todas;
- um hook do Git que roda gates antes de cada commit;
- um `AGENTS.md` enxuto, como porta de entrada dos agentes;
- um registro de incidentes que mostra o harness aprendendo com os erros do agente;
- a API funcionando exatamente como antes.

Esforço de referência: de 5 a 8 horas, somando o tempo dos agentes e o seu.

## O Balcão hoje

Repositório base: <repo a definir>

```
api/                     API (Express + Prisma + Postgres) e worker de triagem
  prisma/                schema, migrations e seed
  src/
    main.ts              entrada da API
    config/              configuração
    domain/              tipos de domínio
    http/                app Express, rotas, middlewares e erros
    services/            regras de negócio
    repositories/        acesso a dados
    integrations/        cliente de IA, real e fake
    jobs/
      triage-worker.ts   entrada do worker
    utils/               utilitários
  test/integration/      testes que exigem banco
web/                     front (React + Vite)
  src/
    main.tsx             entrada do front
blackbox/                suíte caixa-preta da API
docker-compose.yml       Postgres
```

O README atual sobe tudo em seis passos, em três terminais: o Postgres pelo `docker compose`, a instalação da API com a cópia do `api/.env.example` para `api/.env`, as migrations e a seed, a API (porta 4000), o worker de triagem e o front (porta 5173). A seed cria três contas, que a suíte caixa-preta usa:

| Papel | E-mail | Senha |
|---|---|---|
| admin | `admin@balcao.dev` | `Admin@123` |
| atendente | `agente@balcao.dev` | `Agente@123` |
| cliente | `cliente@balcao.dev` | `Cliente@123` |

A IA roda em modo fake por padrão: classifica os chamados por palavras-chave e não precisa de chave nenhuma. Os testes unitários da API ficam ao lado do código (`api/src/**/*.test.ts`) e rodam sem banco. A suíte de `blackbox/` testa a API de fora, pelo endereço em `API_URL`, e precisa da API e do worker no ar.

Suba uma vez seguindo o README antes de mudar qualquer coisa. É o jeito mais rápido de sentir o problema.

## Sobre o foco do desafio

O foco é o harness, não o Balcão. Fazer o código respeitar as invariantes exige refatoração de verdade: a G4 e a G6, sozinhas, mexem em boa parte da API. O que não pode mudar é o comportamento: nenhuma feature nova, nenhuma resposta diferente. A suíte caixa-preta é o seu cinto de segurança.

Algumas travas são propositais, e cada uma tem uma pista:

- O Balcão acha que é a única cópia no mundo. Pista: quando a segunda worktree subir, tudo que tem endereço fixo vira conflito. Procure endereço fixo dos dois lados, API e front, e não só nas portas.
- A documentação mente. Pista: antes de aproveitar qualquer linha do `CLAUDE.md` atual, rode o comando e abra o caminho que ela cita.
- A seed não aguenta uma segunda subida. Pista: rode a subida duas vezes seguidas antes de dizer que ela funciona.
- Os gates vão acender o código inteiro. Pista: escreva as regras primeiro e deixe o agente corrigir guiado pela saída dos gates; é para isso que eles servem.

## Requisitos

### 1. Um ambiente que sobe sozinho, quantas vezes for preciso

Conceitos do curso: Projeto prático (scripts de ambiente, banco por worktree e portas livres), Pós implementação (seed idempotente e subida com seed) e Desenvolvimento paralelo com SDD (conflitos de porta, banco e configuração entre agentes).

Ao final:

- um comando, a partir de um clone limpo, deixa API, worker e front no ar, com o banco migrado e a seed carregada, sem nenhum outro passo;
- esse comando informa os endereços da API e do front, o banco e a pasta de anexos daquela cópia;
- rodar a subida de novo, sem derrubar antes, funciona, sem quebrar nem duplicar a seed;
- outro comando derruba tudo que a subida daquela cópia iniciou, sem afetar outras cópias;
- duas cópias do repositório (ex.: duas worktrees) rodam ao mesmo tempo, cada uma com as suas portas, o seu banco (outra base no mesmo Postgres ou outro Postgres, como preferir), a sua pasta de anexos e o seu worker, e cada front conversa com a API da sua cópia;
- a IA continua em modo fake por padrão.

### 2. Gates que barram o desvio

Conceitos do curso: Princípios de Harness Engineering (guardrails e enforcements mecânicos) e Projeto prático (gates determinísticos de tipos, lint, regras de dependência, arquitetura, testes e código morto, orquestrados por um único comando).

Um único comando roda todas as verificações, sem parar na primeira falha, e no fim lista cada regra violada, pelo ID, com o arquivo. Ele sai com código diferente de zero se qualquer regra falhar. As invariantes abaixo são obrigatórias; as ferramentas são escolha sua.

| ID | Invariante |
|---|---|
| G1 | Zero erro de tipo em `api/` e em `web/`. |
| G2 | Lint sem erro e sem warning em `api/` e em `web/`, acusando pelo menos variável ou import sem uso e `any` explícito. |
| G3 | Os testes unitários da API (`api/src/**/*.test.ts`) rodam e passam. |
| G4 | Nada em `api/src/http/` importa `@prisma/client` nem qualquer módulo de `api/src/repositories/`. |
| G5 | Em `api/src/`, `process.env` só aparece em `api/src/config/`. Em `web/src/`, `import.meta.env` só aparece em `web/src/config/`. |
| G6 | Nada em `api/src/services/` importa `express`, `multer` ou qualquer módulo de `api/src/http/`, inclusive imports só de tipo. |
| G7 | O pacote `openai` só é importado em `api/src/integrations/`. |
| G8 | Nada em `web/` importa arquivos de `api/`, inclusive imports só de tipo. |
| G9 | Nenhum import circular em `api/src/` nem em `web/src/`. |
| G10 | Nenhum arquivo sem uso, export sem uso (inclusive de tipo) ou dependência declarada sem uso em `api/` e em `web/`. |

Repare que G6 e G8 contam também os imports só de tipo. Como cada ferramenta trata esse caso não é abordado no módulo, e descobrir faz parte do desafio.

O código de hoje viola várias dessas invariantes. Na entrega, os gates passam na `main` porque as violações foram corrigidas, não escondidas: comentário de supressão ou arquivo excluído da verificação não vale. A única exceção aceita é a que define a própria regra, como `api/src/config/` na G5.

Além das dez, você define pelo menos duas regras suas: algo que descobriu no Balcão e que vale proteger. Cada uma tem a motivação documentada e um exemplo de violação versionado que, aplicado, faz os gates falharem (ex.: um patch, ou um arquivo guardado fora de `api/src` e `web/src`, aplicado só na hora do teste).

Por fim, um hook do Git roda gates antes de cada commit e bloqueia o commit quando eles falham, no mínimo os de tipo e de lint. Num clone novo, o hook fica ativo depois do comando de subida, sem nenhum passo extra.

### 3. Documentação que não mente

Conceitos do curso: Introdução a Harness Engineering (por que `CLAUDE.md` e `AGENTS.md` não comportam tudo e desatualizam), Princípios de Harness Engineering (o `AGENTS.md` como índice, com progressive disclosure) e Pós implementação (o `AGENTS.md` evolui e corta o desnecessário).

Ao final:

- um `AGENTS.md` na raiz, com no máximo 60 linhas, funciona como índice: como subir, derrubar e rodar os gates, as contas da seed, as regras de camada e onde está o detalhe;
- o `CLAUDE.md` atual sai de cena e passa a apontar para o `AGENTS.md`;
- todo comando e todo caminho citados no `AGENTS.md` existem e funcionam (comando com placeholder vale, se o próprio `AGENTS.md` explica como preenchê-lo);
- o README é reescrito para humanos, com as seções descritas em Entregável.

### 4. Registro de incidentes

Conceitos do curso: Introdução a Harness Engineering (a cada erro do agente, uma mudança no harness para que ele não se repita) e Nova feature - desafio inicial (revisar o `AGENTS.md` com o aprendizado da sessão).

Você vai usar agentes neste trabalho, e eles vão errar. Um arquivo (ex.: `docs/incidentes.md`) registra pelo menos três erros reais, de qualquer agente que você usou. Cada entrada diz o que aconteceu, qual mudança no harness (gate, hook, script ou documento) impede a repetição e o hash do commit dessa mudança.

## O que não pode mudar

- A API HTTP: rotas, corpos, status e códigos de erro. A suíte caixa-preta é o contrato, e o avaliador roda a cópia dela que está no repositório base, não a do seu fork.
- As contas da seed.
- A IA em modo fake por padrão, sem chave.
- As pastas e entradas fixas: `api/src/main.ts`, `api/src/config/`, `api/src/domain/`, `api/src/http/`, `api/src/services/`, `api/src/repositories/`, `api/src/integrations/`, `api/src/jobs/triage-worker.ts`, `web/src/`, `web/src/main.tsx` e o padrão `api/src/**/*.test.ts`. Você pode criar outras pastas e arquivos, mas não renomear nem mover estas: é nelas que o avaliador planta as violações.
- A stack: Express, Prisma, Postgres, React e Vite. Ferramentas de desenvolvimento você adiciona à vontade.
- O worker continua um processo separado da API.

## Tecnologias e restrições

- Agente de código: Claude Code, Codex, Gemini CLI ou Cursor (pode combinar).
- Git e GitHub.
- Docker.

A máquina do avaliador tem só Linux ou macOS, Docker, Git e Node.js LTS. Seus scripts precisam rodar nela; qualquer outra coisa roda em container. No Windows, desenvolva no WSL.

## Fora de escopo

- Features novas e mudanças de comportamento na API ou no front, mesmo que algo pareça bug: o Balcão responde como responde hoje.
- CI, deploy e qualquer ambiente além do local.
- Trocar framework, ORM ou banco.
- Concorrência entre dois workers no mesmo banco: com um banco por cópia, ela não aparece.
- Os testes de integração: continuam existindo, mas nenhum critério os cobra.
- IA real: o modo `openai` continua compilando, mas nenhum critério usa chave. Se for preciso unificar os textos de prompt dele, escolha o que preferir.
- Qualidade visual do front.

## Critérios de aceite

Todos são obrigatórios. O Fluxo do avaliador, logo depois, mostra como cada um é verificado.

Ambiente

☐ Em um clone limpo, o comando de subida deixa API, worker e front no ar, com banco migrado e seed carregada, sem nenhum outro passo, e informa os endereços, o banco e a pasta de anexos da cópia.
☐ Rodar a subida de novo, sem derrubar antes, funciona, e as contas da seed continuam entrando.
☐ Duas worktrees sobem ao mesmo tempo, com portas, banco e pasta de anexos diferentes; o login pelo front funciona nas duas; um chamado criado numa não aparece na outra, e cada uma faz a triagem dos próprios chamados.
☐ Derrubar uma cópia encerra tudo que a subida dela iniciou e não afeta a outra.
☐ A suíte caixa-preta do repositório base passa contra as duas cópias, sem nenhuma chave de IA.

Gates

☐ O comando de gates passa na `main`.
☐ Cada violação plantada pelo avaliador (pelo menos uma por invariante, de G1 a G10) faz o comando falhar, e a lista final cita o ID da invariante e o arquivo.
☐ O comando roda todas as verificações antes de sair, mesmo quando uma delas falha.
☐ Nenhuma violação foi escondida: não há comentários de supressão (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`) em `api/src/` e `web/src/`, e nenhum arquivo dessas pastas fica fora das verificações, salvo as exceções que definem a própria regra (como `api/src/config/` na G5).
☐ Cada regra própria (pelo menos duas) tem motivação documentada e um exemplo de violação versionado que faz os gates falharem.
☐ Num clone novo, depois da subida, o hook bloqueia um commit com erro de tipo e outro com variável sem uso, e a configuração do hook mostra que ele roda tipo e lint.

Documentação e registro

☐ O `AGENTS.md` da raiz tem no máximo 60 linhas e traz como subir, derrubar e rodar os gates, as contas da seed, as regras de camada e onde está o detalhe.
☐ O `CLAUDE.md` aponta para o `AGENTS.md`.
☐ Todo comando e todo caminho citados no `AGENTS.md` existem e funcionam.
☐ O registro de incidentes tem pelo menos três entradas, cada uma com o hash de um commit que existe no histórico e mexe no harness (scripts, configuração de gates, hooks ou documentação para agentes).
☐ O README tem todas as seções descritas em Entregável.
☐ As pastas e entradas fixas continuam onde estavam.

## Fluxo do avaliador

O fluxo é público. `$BASE` é o endereço do repositório base, e os endereços de cada cópia vêm da saída do comando de subida dela.

**1.** Clone o fork numa pasta vazia, `copia-a`, e rode o comando de subida do README. Anote os endereços, o banco e a pasta de anexos informados. Rode a subida mais uma vez, sem derrubar: ela termina sem erro. Abra o front e entre com o cliente da seed.

**2.** Sem derrubar a primeira cópia, crie a segunda e suba também:

```
cd copia-a
git worktree add ../copia-b
cd ../copia-b
```

Rode o comando de subida. As portas, o banco e a pasta de anexos informados são diferentes dos da `copia-a`.

**3.** No front da `copia-a`, como cliente, abra um chamado com o título `Fatura em dobro, urgente` e a descrição `Paguei duas vezes a mesma fatura.`. Em até 15 segundos, a tela do chamado troca "Em triagem" por "Financeiro / prioridade Urgente". Anexe um arquivo `.txt` pequeno ao chamado: ele aparece na pasta de anexos informada pela `copia-a` e não na da `copia-b`. No front da `copia-b`, com o mesmo cliente, a lista não mostra esse chamado; abra um chamado lá também e veja que ele é triado.

**4.** Rode a suíte caixa-preta do repositório base contra as duas cópias:

```
git clone $BASE base-oficial
cd base-oficial/blackbox && npm ci
API_URL=<API da copia-a> npm test
API_URL=<API da copia-b> npm test
```

**5.** Na `copia-a`, rode o comando de gates: passa. Depois o avaliador planta violações, uma de cada vez e pelo menos uma por invariante, de G1 a G10, sempre em arquivos novos dentro das pastas fixas. Para cada uma, roda os gates, confere que falham com o ID e o arquivo na lista final e desfaz a violação. Como quase toda violação plantada também cria um arquivo sem uso, a lista final dessas rodadas traz mais de uma regra, o que mostra que o comando não parou na primeira falha.

**6.** Aplique os exemplos de violação das regras próprias, como o README explica, e confira que os gates falham.

**7.** Teste o hook na `copia-a`:

```
printf "export const total: number = 'muitos'\n" > api/src/services/teste-hook.ts
git add api/src/services/teste-hook.ts && git commit -m "teste do hook"
```

O commit é bloqueado. Desfaça com `git reset -q && rm api/src/services/teste-hook.ts` e repita com uma variável sem uso:

```
printf "export function f(): number {\n  const sobra = 1\n  return 2\n}\n" > api/src/services/teste-hook.ts
git add api/src/services/teste-hook.ts && git commit -m "teste do hook"
```

Também bloqueado. Desfaça de novo e confira, na configuração do hook, que ele roda tipo e lint.

**8.** Procure supressões:

```
git grep -n -E "eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck" -- api/src web/src
```

A busca não encontra nada. Confira também, nas configurações das ferramentas, que nenhum arquivo de `api/src/` ou `web/src/` foi excluído, fora as exceções que definem a própria regra, como `api/src/config/` na G5.

**9.** Derrube a `copia-b`: a `copia-a` continua respondendo em `<API da copia-a>/api/health`. Suba a `copia-b` de novo: sobe sem erro. Derrube as duas.

**10.** Confira a documentação: `wc -l AGENTS.md` dá no máximo 60; o `CLAUDE.md` aponta para o `AGENTS.md`; cada comando citado no `AGENTS.md` roda e cada caminho existe. Para cada incidente do registro, `git show --stat <hash>` mostra um commit que mexe no harness. O README tem as seções descritas em Entregável.

**11.** Confira as pastas e entradas fixas:

```
ls -d api/src/config api/src/domain api/src/http api/src/services api/src/repositories api/src/integrations api/src/main.ts api/src/jobs/triage-worker.ts web/src web/src/main.tsx
```

Harness que só funciona com uma cópia, ou que só barra o que o código de hoje já não faz, não é harness. Se qualquer verificação dos passos 1 a 9 falhar, a entrega está incompleta.

## Entregável

Um fork público do repositório base, com tudo na branch `main`, cujo README tenha:

- Como rodar: pré-requisitos, os comandos de subir, derrubar e gates, e o que a subida informa.
- Contas da seed.
- Gates: as regras (G1 a G10 e as suas), a ferramenta de cada uma e como aplicar o exemplo de violação de cada regra própria.
- Decisões: como as cópias foram isoladas, como as violações que já existiam foram corrigidas e o que mudou na documentação para agentes.
- O link para o registro de incidentes.

## Dicas finais

Dependendo da versão do npm, o `npm install` reescreve metadados dos `package-lock.json` do Balcão. Não é sinal de que você quebrou algo, e existe um jeito de instalar que respeita o lockfile como ele está.

Teste a subida num clone novo, numa pasta nova. O "funciona na minha máquina" mora nos arquivos que o Git ignora, como o `.env` e o `node_modules`.

O agente lê o arquivo de instruções (`CLAUDE.md` ou equivalente) quando a sessão abre. Depois de trocar esse arquivo, a sessão aberta e os subagentes dela continuam com a versão antiga: abra uma sessão nova antes de confiar na troca.

Harness bom não é o que barra mais; é o que faz o próximo agente acertar de primeira.