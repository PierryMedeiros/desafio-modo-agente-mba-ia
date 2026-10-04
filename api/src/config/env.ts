import { z } from 'zod'

// Único lugar da api que lê process.env. Variável vazia (ex.: OPENAI_API_KEY= no .env)
// conta como ausente e cai no padrão.
const emptyAsUndefined = (value: unknown) => (value === '' ? undefined : value)
const fromEnv = <T extends z.ZodType>(schema: T) => z.preprocess(emptyAsUndefined, schema)

const schema = z.object({
  DATABASE_URL: fromEnv(z.string().min(1)),
  NODE_ENV: fromEnv(z.enum(['development', 'test', 'production']).default('development')),
  JWT_SECRET: fromEnv(z.string().default('dev-secret')),
  AI_MODE: fromEnv(z.enum(['fake', 'openai']).default('fake')),
  OPENAI_API_KEY: fromEnv(z.string().optional()),
  UPLOAD_DIR: fromEnv(z.string().default('/tmp/balcao/uploads')),
  PORT: fromEnv(z.coerce.number().int().positive().default(4000)),
  TRIAGE_INTERVAL_MS: fromEnv(z.coerce.number().int().nonnegative().default(2000)),
  WEB_ORIGIN: fromEnv(z.string().default('http://localhost:5173')),
})

export const env = schema.parse(process.env)
