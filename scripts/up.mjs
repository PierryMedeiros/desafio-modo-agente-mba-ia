#!/usr/bin/env node
// Sobe ESTA cópia do Balcão (clone ou worktree): dependências, hook do git, Postgres próprio,
// migrations, seed idempotente, API, worker e front, cada um com as portas da cópia.
// Pode rodar de novo sem derrubar: o que já está no ar fica como está.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  PROCESSES,
  allocateSlot,
  compose,
  copyIdentity,
  isGroupAlive,
  isPortFree,
  logDir,
  pidDir,
  pidFile,
  portsForSlot,
  readPid,
  readState,
  root,
  writeState,
} from './lib/copia.mjs'

const step = (msg) => console.log(`\n==> ${msg}`)

function fail(msg) {
  console.error(`\nERRO: ${msg}`)
  process.exit(1)
}

function checkPrerequisites() {
  const major = Number(process.versions.node.split('.')[0])
  if (major < 22) fail(`Node.js 22 ou superior é necessário (atual: ${process.version}).`)
  if (spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' }).status !== 0) {
    fail('Docker com "docker compose" é necessário e precisa estar rodando.')
  }
}

// npm ci respeita o lockfile como está. Só reinstala quando o lockfile mudou depois da última instalação.
function installDeps(dir) {
  const lock = path.join(root, dir, 'package-lock.json')
  const marker = path.join(root, dir, 'node_modules', '.package-lock.json')
  if (existsSync(marker) && statSync(marker).mtimeMs >= statSync(lock).mtimeMs) return
  console.log(`npm ci em ${dir === '.' ? 'raiz' : dir}/`)
  execFileSync('npm', ['ci', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: path.join(root, dir), stdio: 'inherit' })
}

function installHook() {
  if (spawnSync('git', ['rev-parse', '--git-dir'], { cwd: root, stdio: 'ignore' }).status !== 0) return
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root })
}

// Mantém o que já existe no api/.env (ex.: AI_MODE, OPENAI_API_KEY) e sobrescreve o que é da cópia.
function writeApiEnv(values) {
  const envFile = path.join(root, 'api', '.env')
  const base = existsSync(envFile) ? envFile : path.join(root, 'api', '.env.example')
  const lines = readFileSync(base, 'utf8').split('\n').filter((l) => l.trim() !== '')
  const seen = new Set()
  const out = lines.map((line) => {
    const key = line.split('=')[0].trim()
    if (key in values) {
      seen.add(key)
      return `${key}=${values[key]}`
    }
    return line
  })
  for (const [key, value] of Object.entries(values)) if (!seen.has(key)) out.push(`${key}=${value}`)
  writeFileSync(envFile, `${out.join('\n')}\n`)
}

function apiRun(args, env) {
  execFileSync('npx', args, { cwd: path.join(root, 'api'), env, stdio: ['ignore', 'pipe', 'inherit'] })
}

async function startProcess(name, { cwd, args, env, port }) {
  const pid = readPid(name)
  if (pid && isGroupAlive(pid)) {
    console.log(`${name}: já está no ar (pid ${pid})`)
    return
  }
  if (port && !(await isPortFree(port))) {
    fail(`a porta ${port} (${name}) está ocupada por um processo que não é desta cópia. Veja quem é com "lsof -i :${port}".`)
  }
  const log = openSync(path.join(logDir, `${name}.log`), 'a')
  const child = spawn('npm', args, { cwd, env, detached: true, stdio: ['ignore', log, log] })
  writeFileSync(pidFile(name), `${child.pid}\n`)
  child.unref()
  console.log(`${name}: iniciado (pid ${child.pid}, log .balcao/logs/${name}.log)`)
}

async function waitFor(name, check, timeoutMs = 90000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const pid = readPid(name)
    if (!pid || !isGroupAlive(pid)) break
    if (await check()) return
    await new Promise((r) => setTimeout(r, 500))
  }
  const logFile = path.join(logDir, `${name}.log`)
  const tail = existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').slice(-15).join('\n') : ''
  fail(`${name} não ficou de pé. Últimas linhas de .balcao/logs/${name}.log:\n${tail}`)
}

const httpOk = (url) => () =>
  fetch(url, { signal: AbortSignal.timeout(2000) })
    .then((res) => res.ok)
    .catch(() => false)

const logHas = (name, text) => () => {
  const file = path.join(logDir, `${name}.log`)
  return existsSync(file) && readFileSync(file, 'utf8').includes(text)
}

async function main() {
  checkPrerequisites()
  const identity = copyIdentity()
  const state = readState() ?? { slot: await allocateSlot() }
  const ports = portsForSlot(state.slot)
  writeState({ ...state, ...identity, ports })
  mkdirSync(logDir, { recursive: true })
  mkdirSync(pidDir, { recursive: true })
  mkdirSync(identity.uploadDir, { recursive: true })

  const apiUrl = `http://localhost:${ports.api}`
  const webUrl = `http://localhost:${ports.web}`
  const databaseUrl = `postgresql://balcao:balcao@localhost:${ports.db}/${identity.dbName}`

  step('Dependências')
  for (const dir of ['.', 'api', 'web']) installDeps(dir)
  installHook()

  step(`Postgres da cópia (${identity.project}, porta ${ports.db})`)
  compose(identity, ports, ['up', '-d', '--wait'])

  step('Configuração, migrations e seed')
  const copyEnv = {
    DATABASE_URL: databaseUrl,
    DATABASE_URL_TEST: `postgresql://balcao:balcao@localhost:${ports.db}/balcao_test`,
    PORT: String(ports.api),
    UPLOAD_DIR: identity.uploadDir,
    WEB_ORIGIN: webUrl,
  }
  writeApiEnv(copyEnv)
  // O ambiente da cópia vence qualquer variável herdada do shell (ex.: um DATABASE_URL de outra cópia).
  const apiEnv = { ...process.env, ...copyEnv }
  apiRun(['prisma', 'generate'], apiEnv)
  apiRun(['prisma', 'migrate', 'deploy'], apiEnv)
  execFileSync('npm', ['run', 'seed', '--silent'], { cwd: path.join(root, 'api'), env: apiEnv, stdio: 'inherit' })

  step('Processos')
  const webEnv = { ...process.env, WEB_PORT: String(ports.web), VITE_API_URL: apiUrl }
  await startProcess('api', { cwd: path.join(root, 'api'), args: ['run', 'dev'], env: apiEnv, port: ports.api })
  await startProcess('worker', { cwd: path.join(root, 'api'), args: ['run', 'worker'], env: apiEnv })
  await startProcess('web', { cwd: path.join(root, 'web'), args: ['run', 'dev'], env: webEnv, port: ports.web })

  await waitFor('api', httpOk(`${apiUrl}/api/health`))
  await waitFor('worker', logHas('worker', 'worker de triagem rodando'))
  await waitFor('web', httpOk(webUrl))

  const pids = Object.fromEntries(PROCESSES.map((p) => [p, readPid(p)]))
  console.log(`
Balcão no ar nesta cópia: ${root}
  API:     ${apiUrl}   (saúde: ${apiUrl}/api/health)
  Front:   ${webUrl}
  Banco:   ${databaseUrl}   (container do projeto ${identity.project})
  Anexos:  ${identity.uploadDir}
  Worker:  pid ${pids.worker}, IA em modo ${readAiMode()}
  Logs:    ${path.join(root, '.balcao', 'logs')}
Derrubar esta cópia: npm run down`)
}

function readAiMode() {
  const line = readFileSync(path.join(root, 'api', '.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith('AI_MODE='))
  return line ? line.slice('AI_MODE='.length) || 'fake' : 'fake'
}

main().catch((err) => fail(err.message))
