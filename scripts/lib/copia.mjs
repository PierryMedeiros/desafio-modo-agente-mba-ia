// Identidade e estado de UMA cópia do Balcão (um clone ou uma worktree).
// Tudo que é da cópia fica em <raiz>/.balcao/ (ignorado pelo git): estado, PIDs, logs e anexos.
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'))
const stateDir = path.join(root, '.balcao')
export const logDir = path.join(stateDir, 'logs')
export const pidDir = path.join(stateDir, 'pids')
const stateFile = path.join(stateDir, 'state.json')

export const PROCESSES = ['api', 'worker', 'web']

export function copyIdentity() {
  const hash = createHash('sha1').update(root).digest('hex').slice(0, 6)
  const slug = path.basename(root).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'copia'
  return {
    project: `balcao-${slug.replace(/_/g, '-')}-${hash}`,
    dbName: `balcao_${slug}_${hash}`,
    uploadDir: path.join(stateDir, 'uploads'),
  }
}

export function readState() {
  return existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null
}

export function writeState(state) {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`)
}

// Registro de slots na pasta comum do git: todas as worktrees de um clone o enxergam,
// então uma cópia derrubada não perde as portas para outra que suba depois.
function registryFile() {
  const res = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' })
  return res.status === 0 ? path.join(res.stdout.trim(), 'balcao-copias.json') : null
}

function readRegistry(file) {
  if (!file || !existsSync(file)) return {}
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

export const portsForSlot = (slot) => ({ api: 4000 + slot, web: 5173 + slot, db: 5432 + slot })

export async function allocateSlot() {
  const file = registryFile()
  const registry = readRegistry(file)
  if (registry[root] !== undefined) return registry[root]
  const taken = new Set(Object.entries(registry).filter(([dir]) => dir !== root && existsSync(dir)).map(([, slot]) => slot))
  for (let slot = 0; slot < 100; slot++) {
    if (taken.has(slot)) continue
    const ports = Object.values(portsForSlot(slot))
    if ((await Promise.all(ports.map(isPortFree))).every(Boolean)) {
      if (file) writeFileSync(file, `${JSON.stringify({ ...registry, [root]: slot }, null, 2)}\n`)
      return slot
    }
  }
  throw new Error('nenhum conjunto de portas livre entre os slots 0 e 99')
}

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (err) => resolve(err.code === 'EADDRNOTAVAIL' || err.code === 'EAFNOSUPPORT'))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, host)
  })
}

export async function isPortFree(port) {
  for (const host of ['127.0.0.1', '0.0.0.0', '::1', '::']) {
    if (!(await canListen(port, host))) return false
  }
  return true
}

export function pidFile(name) {
  return path.join(pidDir, `${name}.pid`)
}

export function readPid(name) {
  const file = pidFile(name)
  if (!existsSync(file)) return null
  const pid = Number(readFileSync(file, 'utf8').trim())
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

// Cada processo sobe como líder do próprio grupo (detached), então o grupo inteiro
// (npm -> tsx -> node) responde por -pid. Nada de pkill por nome.
export function isGroupAlive(pid) {
  try {
    process.kill(-pid, 0)
    return true
  } catch (err) {
    return err.code === 'EPERM'
  }
}

export function compose(identity, ports, args, options = {}) {
  return execFileSync('docker', ['compose', '-p', identity.project, '-f', path.join(root, 'docker-compose.yml'), ...args], {
    cwd: root,
    env: { ...process.env, BALCAO_DB_PORT: String(ports.db), BALCAO_DB_NAME: identity.dbName },
    stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  })
}
