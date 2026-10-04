#!/usr/bin/env node
// Gates do Balcão: roda todas as verificações, sem parar na primeira falha, e no fim
// lista cada regra violada com o ID (G1..G10, R1, R2) e o arquivo.
// Uso: npm run gates            (todas)
//      npm run gates -- G1 G2   (só as verificações que cobrem esses IDs)
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bin = (pkgDir, name) => path.join(root, pkgDir, 'node_modules', '.bin', name)
const tmp = mkdtempSync(path.join(tmpdir(), 'balcao-gates-'))

function run(cmd, args, cwd = root) {
  const res = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { code: res.status ?? 1, out: `${res.stdout || ''}${res.stderr || ''}`, stdout: res.stdout || '' }
}

function requireBin(pkgDir, name) {
  const file = bin(pkgDir, name)
  if (!existsSync(file)) throw new Error(`${file} não existe. Rode "npm run up" (ele instala as dependências).`)
  return file
}

const rel = (file) => path.relative(root, path.resolve(root, file)).split(path.sep).join('/')

// Cada verificação devolve uma lista de { id, file, detail }.
const checks = [
  {
    name: 'tipos da api (tsc)',
    ids: ['G1'],
    exec: () => typecheck('api'),
  },
  {
    name: 'tipos do web (tsc)',
    ids: ['G1'],
    exec: () => typecheck('web'),
  },
  {
    name: 'lint, env e endereços fixos (eslint)',
    ids: ['G2', 'G5', 'R1'],
    exec: () => {
      const res = run(requireBin('.', 'eslint'), ['api', 'web', '--format', 'json', '--max-warnings', '0'])
      const reports = parseJson(res.stdout, 'eslint', res.out)
      const found = []
      for (const report of reports) {
        for (const msg of report.messages) {
          const tag = /^\[(G\d+|R\d+)\]/.exec(msg.message)
          found.push({
            id: tag ? tag[1] : 'G2',
            file: rel(report.filePath),
            detail: `${msg.line}:${msg.column} ${tag ? msg.message.slice(tag[0].length).trim() : `${msg.message} (${msg.ruleId || 'parse'})`}`,
          })
        }
      }
      return found
    },
  },
  {
    name: 'testes unitários da api (vitest)',
    ids: ['G3'],
    exec: () => {
      const outFile = path.join(tmp, 'vitest.json')
      const res = run(requireBin('api', 'vitest'), ['run', '--reporter=json', `--outputFile=${outFile}`], path.join(root, 'api'))
      if (res.code === 0) return []
      if (!existsSync(outFile)) return [{ id: 'G3', file: 'api/src', detail: lastLines(res.out) }]
      const report = JSON.parse(readFileSync(outFile, 'utf8'))
      const failed = report.testResults
        .filter((t) => t.status !== 'passed')
        .map((t) => ({
          id: 'G3',
          file: rel(t.name),
          detail: (t.assertionResults || []).filter((a) => a.status === 'failed').map((a) => a.title).join('; ') || firstLine(t.message),
        }))
      return failed.length ? failed : [{ id: 'G3', file: 'api/src', detail: lastLines(res.out) }]
    },
  },
  {
    name: 'camadas, imports e ciclos (dependency-cruiser)',
    ids: ['G4', 'G6', 'G7', 'G8', 'G9', 'R2'],
    exec: () => {
      requireBin('.', 'depcruise')
      const res = run('npm', ['run', '--silent', 'gates:deps', '--', '--output-type', 'json'])
      const report = parseJson(res.stdout, 'dependency-cruiser', res.out)
      return report.summary.violations.map((v) => ({
        id: v.rule.name.split('-')[0],
        file: v.from,
        detail: v.cycle ? `ciclo: ${[v.from, ...v.cycle.map((c) => c.name ?? c)].join(' -> ')}` : `importa ${v.to}`,
      }))
    },
  },
  {
    name: 'código e dependências sem uso (knip)',
    ids: ['G10'],
    exec: () => {
      const res = run(requireBin('.', 'knip'), ['--reporter', 'json', '--no-progress', '--no-config-hints'])
      const report = parseJson(res.stdout, 'knip', res.out)
      const found = []
      for (const file of report.files || []) found.push({ id: 'G10', file: rel(file), detail: 'arquivo sem uso' })
      for (const issue of report.issues || []) {
        for (const [kind, list] of Object.entries(issue)) {
          if (kind === 'file' || kind === 'owners') continue
          const items = Array.isArray(list) ? list : Object.values(list || {})
          const names = items.map((i) => (typeof i === 'string' ? i : i?.name)).filter(Boolean)
          if (kind === 'files' && items.length) found.push({ id: 'G10', file: rel(issue.file), detail: 'arquivo sem uso' })
          else if (names.length) found.push({ id: 'G10', file: rel(issue.file), detail: `${kind} sem uso: ${names.join(', ')}` })
        }
      }
      if (!found.length && res.code !== 0) found.push({ id: 'G10', file: '.', detail: lastLines(res.out) })
      return found
    },
  },
]

function typecheck(pkg) {
  const res = run(requireBin(pkg, 'tsc'), ['--noEmit', '-p', `${pkg}/tsconfig.json`, '--pretty', 'false'])
  if (res.code === 0) return []
  const found = []
  for (const line of res.out.split('\n')) {
    const m = /^(.+?)\(\d+,\d+\): error (TS\d+: .*)$/.exec(line.trim())
    if (m) found.push({ id: 'G1', file: rel(path.isAbsolute(m[1]) ? m[1] : path.join(root, m[1])), detail: m[2] })
  }
  return found.length ? found : [{ id: 'G1', file: pkg, detail: lastLines(res.out) }]
}

function parseJson(text, tool, fullOutput) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${tool} não gerou JSON:\n${lastLines(fullOutput)}`)
  }
}

const firstLine = (text = '') => text.trim().split('\n')[0]
const lastLines = (text = '') => text.trim().split('\n').slice(-5).join(' | ')

const wanted = process.argv.slice(2).map((a) => a.toUpperCase())
const selected = wanted.length ? checks.filter((c) => c.ids.some((id) => wanted.includes(id))) : checks

const violations = []
for (const check of selected) {
  const started = Date.now()
  let found
  try {
    found = check.exec()
  } catch (err) {
    found = [{ id: check.ids[0], file: '-', detail: `a verificação não rodou: ${err.message}` }]
  }
  if (wanted.length) found = found.filter((v) => wanted.includes(v.id))
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`${found.length ? 'FALHOU' : 'ok    '} ${check.name} [${check.ids.join(', ')}] ${secs}s`)
  violations.push(...found)
}
rmSync(tmp, { recursive: true, force: true })

if (!violations.length) {
  console.log('\nGates: tudo passou.')
  process.exit(0)
}

const order = (id) => (id[0] === 'G' ? 0 : 100) + Number(id.slice(1))
violations.sort((a, b) => order(a.id) - order(b.id) || a.file.localeCompare(b.file))
console.log(`\nGates: ${violations.length} violação(ões). Regras violadas: ${[...new Set(violations.map((v) => v.id))].join(', ')}\n`)
for (const v of violations) console.log(`${v.id.padEnd(4)} ${v.file}  ${v.detail}`)
console.log('\nDetalhe de cada regra: docs/gates.md')
process.exit(1)
