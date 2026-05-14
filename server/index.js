process.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); process.exit(1) })
process.on('unhandledRejection', (err) => { console.error('Unhandled Rejection:', err); process.exit(1) })

import express from 'express'
import cors from 'cors'
import { initDB } from './db.js'
import authRoutes from './routes/auth.js'
import branchRoutes from './routes/branches.js'
import itemRoutes from './routes/items.js'
import inboundRoutes from './routes/inbound.js'
import outboundRoutes from './routes/outbound.js'
import userRoutes from './routes/users.js'
import reportRoutes from './routes/reports.js'
import vendorRoutes from './routes/vendors.js'
import categoryRoutes from './routes/categories.js'
import unitRoutes from './routes/units.js'
import fiscalYearRoutes from './routes/fiscalYears.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://sgic-inventory-mq7m.vercel.app',
    /\.vercel\.app$/,
  ],
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/branches', branchRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/inbound', inboundRoutes)
app.use('/api/outbound', outboundRoutes)
app.use('/api/users', userRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/vendors', vendorRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/units', unitRoutes)
app.use('/api/fiscal-years', fiscalYearRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

initDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please close other instances and try again.`)
        process.exit(1)
      }
      throw err
    })
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  })
