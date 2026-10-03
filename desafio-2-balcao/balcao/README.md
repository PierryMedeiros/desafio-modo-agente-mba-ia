# Balcão

Central de chamados. Clientes abrem chamados, uma IA faz a triagem (categoria e prioridade) em segundo plano, atendentes assumem, respondem e resolvem, e o admin acompanha as estatísticas.

- `api/`: API em Express + Prisma e o worker de triagem.
- `web/`: front em React + Vite.
- `blackbox/`: testes caixa-preta da API.

## Pré-requisitos

- Node.js 22 ou superior
- Docker com `docker compose`

## Como subir

Siga os passos na ordem. Cada parte roda em um terminal separado.

**1.** Na raiz do projeto, suba o banco (Postgres 16 na porta 5432, banco `balcao`, usuário e senha `balcao`):

```bash
docker compose up -d
```

**2.** Instale as dependências da API e crie o `.env`:

```bash
cd api && npm install && cp .env.example .env
```

**3.** Ainda dentro de `api/`, rode as migrations e a seed:

```bash
npx prisma migrate deploy && npm run seed
```

**4.** Ainda dentro de `api/`, suba a API (porta 4000):

```bash
npm run dev
```

**5.** Em outro terminal, a partir da raiz, suba o worker de triagem:

```bash
cd api && npm run worker
```

**6.** Em outro terminal, a partir da raiz, suba o front (porta 5173):

```bash
cd web && npm install && npm run dev
```

Abra http://localhost:5173.

## Contas da seed

| Papel | E-mail | Senha |
|---|---|---|
| admin | `admin@balcao.dev` | `Admin@123` |
| atendente | `agente@balcao.dev` | `Agente@123` |
| cliente | `cliente@balcao.dev` | `Cliente@123` |

## IA

Por padrão a API usa o modo fake (`AI_MODE=fake` no `.env`), que classifica os chamados por palavras-chave e não precisa de chave nenhuma. Para usar a OpenAI, coloque `AI_MODE=openai` e preencha `OPENAI_API_KEY`.

## Testes

**Unitários**, dentro de `api/` (não precisam de banco):

```bash
npm test
```

**Integração**, dentro de `api/`. Eles usam um banco separado, `balcao_test`, que precisa ser criado e migrado na mão antes da primeira vez. Com o banco do passo 1 no ar, a partir da raiz:

```bash
docker compose exec db psql -U balcao -c "CREATE DATABASE balcao_test"
cd api
DATABASE_URL=postgresql://balcao:balcao@localhost:5432/balcao_test npx prisma migrate deploy
npm run test:integration
```

**Caixa-preta**, com a API e o worker no ar (passos 4 e 5), a partir da raiz:

```bash
cd blackbox && npm install && npm test
```

## Problemas comuns

- **Porta 4000 ocupada**: tem outra API rodando. Descubra o processo com `lsof -i :4000` e mate com `kill -9 <pid>`.
- **Porta 5173 ocupada**: o Vite não troca de porta sozinho. Mate o processo que está nela, do mesmo jeito.
- **Porta 5432 ocupada**: provavelmente tem um Postgres instalado na máquina. Pare ele (`sudo service postgresql stop`) antes do passo 1.
- **A seed falha com "Unique constraint failed"**: a seed já rodou nesse banco. Para começar do zero, rode `docker compose down -v` e volte ao passo 1.
- **Chamado fica "Em triagem" para sempre**: o worker não está rodando. Veja o passo 5.
- **Erro de CORS no navegador**: abra o front em `http://localhost:5173`, e não em `127.0.0.1`.
- **Os anexos sumiram**: eles ficam em `/tmp/balcao/uploads`, que é apagado quando a máquina reinicia.
