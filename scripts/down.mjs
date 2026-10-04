#!/usr/bin/env node
// Derruba o que `npm run up` iniciou NESTA cópia: API, worker e front (pelo grupo de processos
// registrado em .balcao/pids) e o container do Postgres desta cópia. Outras cópias não são tocadas.
// Os dados ficam no volume da cópia; `npm run down -- --limpar` apaga banco e anexos também.
import { existsSync, rmSync } from 'node:fs'
import { PROCESSES, compose, copyIdentity, isGroupAlive, pidFile, portsForSlot, readPid, readState } from './lib/copia.mjs'

const wipe = process.argv.includes('--limpar')

async function stopGroup(name) {
  const pid = readPid(name)
  if (!pid) return console.log(`${name}: não estava no ar`)
  if (isGroupAlive(pid)) {
    process.kill(-pid, 'SIGTERM')
    for (let i = 0; i < 50 && isGroupAlive(pid); i++) await new Promise((r) => setTimeout(r, 100))
    if (isGroupAlive(pid)) process.kill(-pid, 'SIGKILL')
    console.log(`${name}: encerrado (grupo ${pid})`)
  } else {
    console.log(`${name}: não estava no ar`)
  }
  rmSync(pidFile(name), { force: true })
}

async function main() {
  const state = readState()
  if (!state) {
    console.log('Esta cópia nunca subiu (não há .balcao/state.json). Nada a derrubar.')
    return
  }
  for (const name of [...PROCESSES].reverse()) await stopGroup(name)

  const identity = copyIdentity()
  const ports = portsForSlot(state.slot)
  compose(identity, ports, wipe ? ['down', '--volumes'] : ['down'])
  if (wipe && existsSync(identity.uploadDir)) rmSync(identity.uploadDir, { recursive: true, force: true })
  console.log(`\nCópia derrubada: ${identity.project}${wipe ? ' (banco e anexos apagados)' : ''}`)
}

main().catch((err) => {
  console.error(`ERRO: ${err.message}`)
  process.exit(1)
})
