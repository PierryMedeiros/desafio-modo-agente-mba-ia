import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A porta vem de WEB_PORT, definida por `npm run up` para cada cópia. strictPort: se a porta
// estiver ocupada o Vite falha em vez de pular para outra, e a subida percebe.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT || 5173),
    strictPort: true,
  },
})
