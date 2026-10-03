import express from 'express'
import cors from 'cors'
import healthRoutes from './routes/health'
import authRoutes from './routes/auth'
import ticketRoutes from './routes/tickets'
import attachmentRoutes from './routes/attachments'
import statsRoutes from './routes/stats'
import { errorHandler, notFoundHandler } from './errors'

export const app = express()

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/attachments', attachmentRoutes)
app.use('/api/stats', statsRoutes)

app.use(notFoundHandler)
app.use(errorHandler)
