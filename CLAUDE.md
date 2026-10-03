# CLAUDE.md

Instruções para o Claude Code neste repositório. Leia tudo antes de mexer em qualquer arquivo.

## Sobre o projeto

O Balcão é a central de chamados da empresa. Clientes abrem chamados, o worker classifica cada chamado com IA, os atendentes respondem e resolvem e o admin acompanha as estatísticas. São três partes: a API (Express + Prisma), o worker de triagem e o front (React + Vite).

## Estrutura

```
api/
  prisma/
    schema.prisma
    seed.ts
  src/
    controllers/      handlers das rotas
    services/         regras de negócio
    repositories/     acesso ao banco
    middlewares/      autenticação e permissões
    jobs/             worker de triagem
    main.ts
  tests/              testes da API
web/
  src/
    pages/
    components/
    store/            estado global (usuário logado e token)
    api/
docker-compose.yml
```

## Regras gerais

- Sempre responda em português.
- Sempre leia o README antes de começar uma tarefa.
- Sempre rode `npm install` antes de qualquer comando, mesmo que a pasta `node_modules` já exista.
- Sempre rode `docker compose up -d` antes de `npm run dev`.
- Sempre rode `npm run migrate` antes de subir a API.
- Nunca use a porta 3000. Ela é de outro sistema da empresa.
- Nunca mude as portas 4000, 5173 e 5432.
- Se der EADDRINUSE, use `kill -9` no processo que está na porta e suba de novo.
- Não crie arquivos novos sem necessidade.
- Não instale bibliotecas novas sem perguntar antes.
- Se o TypeScript reclamar de tipo em handler, use `any` para não travar a entrega.
- Para depurar, use `console.log`. Lembre de tirar antes de commitar.
- Nunca apague arquivos que você não criou.

## API

- Toda rota nova vai em `api/src/controllers/`, um arquivo por recurso.
- Sempre registre a rota nova no `app.ts`.
- Erros sempre no formato `{"error": "...", "message": "..."}`.
- Sempre teste a rota com `curl` antes de dizer que terminou.
- Sempre reinicie a API depois de mudar o `.env`.
- O JWT dura 8 horas. Se o token expirar, faça login de novo.

## Banco de dados

- Sempre rode `npm run migrate` depois de alterar o `schema.prisma`.
- Nunca edite uma migration que já foi aplicada.
- Nunca rode a seed duas vezes no mesmo banco.
- Se a seed falhar, rode `docker compose down -v` e comece tudo de novo.
- Para olhar os dados, use `npx prisma studio`.

## Worker

- O worker precisa estar rodando para a triagem funcionar.
- Sempre suba a API antes do worker.
- Se o worker travar, mate com `kill -9` e suba de novo com `npm run worker`.
- Para testar a falha da triagem, coloque `[falha-ia]` no título do chamado.

## Front

- Sempre suba a API antes do front.
- O token fica no `localStorage`.
- Para chamar a API, use o axios.
- Não use biblioteca de componentes. O CSS fica em `styles.css`.
- Se a tela ficar em branco, limpe o `localStorage` e faça login de novo.

## Testes

- Os testes ficam em `api/tests/`, separados do código. Nunca coloque teste dentro de `src/`.
- Sempre rode `npm test` antes de commitar.
- Sempre rode a seed antes dos testes caixa-preta.
- Os testes de integração usam o banco `balcao_test`. Nunca rode contra o banco `balcao`.
- Todo arquivo novo em `api/src/services/` precisa de um teste ao lado dele, na mesma pasta, com o sufixo `.test.ts`.
- Se um teste caixa-preta falhar, rode de novo antes de investigar.

## Commits

- Mensagens curtas, em português ou inglês.
- Sempre rode `npm test` e `npm run dev` antes de commitar.
- Nunca faça commit do `.env`.
- Um commit por tarefa.

## Fluxo de trabalho

1. Sempre rode `git pull` antes de começar.
2. Sempre rode `npm install` em `api/` e em `web/`.
3. Sempre rode `docker compose up -d`.
4. Sempre rode `npm run migrate`.
5. Sempre suba a API, o worker e o front, nessa ordem.
6. Faça a alteração.
7. Sempre rode `npm test`.
8. Sempre teste no navegador com as três contas da seed.
9. Commit.

## Problemas conhecidos

- EADDRINUSE na 4000 ou na 5173: `kill -9` no processo e suba de novo.
- "Prisma Client did not initialize yet": rode `npx prisma generate`.
- Chamado parado em "Em triagem": o worker caiu, suba de novo.
- Erro de CORS: abra o front em `http://localhost:5173`.
