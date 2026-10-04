import { defineConfig } from 'vitest/config'

try {
  process.loadEnvFile('.env')
} catch {
  // Sem .env: DATABASE_URL_TEST tem de vir do ambiente.
}

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST || '',
    },
  },
})
