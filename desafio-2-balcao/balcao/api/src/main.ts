import { app } from './http/app'

const port = process.env.PORT || 4000

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`)
})
