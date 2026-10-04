#!/usr/bin/env node
// Autoteste dos gates: planta uma violação de cada regra (G1..G10, R1, R2) em arquivo novo
// dentro das pastas fixas, roda os gates e exige que a lista final traga o ID e o arquivo.
// Desfaz cada amostra antes da próxima. Rode depois de mexer em qualquer config de gate:
// uma config que deixa de enxergar uma regra passa no `npm run gates`, mas falha aqui.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const samples = [
  { id: 'G1', files: { 'api/src/services/amostra-g1.ts': "export const total: number = 'muitos'\n" } },
  { id: 'G1', files: { 'web/src/config/amostra-g1.ts': "export const total: number = 'muitos'\n" } },
  { id: 'G2', files: { 'api/src/services/amostra-g2.ts': 'export function f(): number {\n  const sobra = 1\n  return 2\n}\n' } },
  { id: 'G2', files: { 'web/src/utils/amostra-g2.ts': 'export function f(x: any) {\n  return x\n}\n' } },
  {
    id: 'G3',
    files: { 'api/src/services/amostra-g3.test.ts': "import { expect, it } from 'vitest'\n\nit('falha', () => {\n  expect(1).toBe(2)\n})\n" },
  },
  { id: 'G4', files: { 'api/src/http/amostra-g4.ts': "import { PrismaClient } from '@prisma/client'\n\nexport const db = new PrismaClient()\n" } },
  { id: 'G5', files: { 'api/src/services/amostra-g5.ts': 'export const porta = process.env.PORT\n' } },
  { id: 'G5', files: { 'web/src/pages/amostra-g5.ts': 'export const url = import.meta.env.VITE_API_URL\n' } },
  {
    id: 'G6',
    files: { 'api/src/services/amostra-g6.ts': "import type { Request } from 'express'\n\nexport type Pedido = Request\n" },
  },
  { id: 'G7', files: { 'api/src/services/amostra-g7.ts': "import OpenAI from 'openai'\n\nexport const ia = new OpenAI({ apiKey: 'x' })\n" } },
  {
    id: 'G8',
    files: { 'web/src/amostra-g8.ts': "import type { Ticket } from '../../api/src/domain/ticket'\n\nexport type T = Ticket\n" },
  },
  {
    id: 'G9',
    files: {
      'api/src/domain/amostra-g9-a.ts': "import { b } from './amostra-g9-b'\n\nexport const a = () => b()\n",
      'api/src/domain/amostra-g9-b.ts': "import { a } from './amostra-g9-a'\n\nexport const b = () => a()\n",
    },
  },
  { id: 'G10', files: { 'api/src/services/amostra-g10.ts': 'export const sobra = 1\n' } },
  { id: 'R1', patch: 'harness/violacoes/R1-endereco-fixo.patch', expect: 'api/src/services/exemplo-r1.ts' },
  { id: 'R2', patch: 'harness/violacoes/R2-prisma-fora-de-repositories.patch', expect: 'api/src/jobs/exemplo-r2.ts' },
]

function gates() {
  const res = spawnSync('node', ['scripts/gates.mjs'], { cwd: root, encoding: 'utf8' })
  return { code: res.status, out: `${res.stdout}${res.stderr}` }
}

const base = gates()
if (base.code !== 0) {
  console.error('Os gates precisam passar antes do autoteste. Saída:\n' + base.out)
  process.exit(1)
}

let failures = 0
for (const sample of samples) {
  const files = sample.files ? Object.keys(sample.files) : [sample.expect]
  try {
    if (sample.patch) execFileSync('git', ['apply', sample.patch], { cwd: root })
    else
      for (const [file, content] of Object.entries(sample.files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
        writeFileSync(path.join(root, file), content)
      }
    const { code, out } = gates()
    const hit = files.some((f) => out.split('\n').some((line) => line.startsWith(`${sample.id.padEnd(4)} ${f}`)))
    const ok = code !== 0 && hit
    if (!ok) failures++
    const others = [...new Set(out.split('\n').map((l) => /^(G\d+|R\d+)\s/.exec(l)?.[1]).filter(Boolean))]
    console.log(`${ok ? 'ok    ' : 'FALHOU'} ${sample.id} em ${files.join(', ')}  (lista final: ${others.join(', ') || 'vazia'})`)
  } finally {
    if (sample.patch) execFileSync('git', ['apply', '-R', sample.patch], { cwd: root })
    else for (const file of files) if (existsSync(path.join(root, file))) rmSync(path.join(root, file))
  }
}

console.log(failures ? `\nAutoteste: ${failures} amostra(s) passaram despercebidas.` : '\nAutoteste: todos os gates acusaram as amostras.')
process.exit(failures ? 1 : 0)
