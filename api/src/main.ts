import { env } from './config/env'
import { buildServices } from './composition/services'
import { createApp } from './http/app'

const app = createApp(buildServices(), { corsOrigin: env.WEB_ORIGIN })

app.listen(env.PORT, () => {
  console.log(`API rodando na porta ${env.PORT}`)
})
