import express from 'express'
import bcrypt from 'bcryptjs'
import { run, get } from '../db.js'
import { generateToken, auth, adminOnly, logAction } from '../middleware.js'

const router = express.Router()

// GET /api/auth/ping — wake up Render free tier
router.get('/ping', (req, res) => res.json({ ok: true }))

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await get('SELECT * FROM users WHERE email = $1 AND active = 1', [email])

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = generateToken(user.id)

    await logAction(user.id, 'LOGIN', 'user', user.id, `User ${user.username} logged in`)

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/auth/register
// If no admin exists yet, allow registration as admin without auth.
// Otherwise requires auth + admin role.
router.post('/register', async (req, res, next) => {
  const existingAdmin = await get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`)
  if (!existingAdmin) {
    return next()
  }
  auth(req, res, () => adminOnly(req, res, next))
}, async (req, res) => {
  try {
    const { username, email, password, role = 'staff', branch_id = null } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' })
    }

    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or staff' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const result = await run(
      `INSERT INTO users (username, email, password, role, branch_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [username, email, hashed, role, branch_id]
    )

    if (req.user) {
      await logAction(req.user.id, 'CREATE_USER', 'user', result.lastID, `Created user ${username}`)
    }

    res.status(201).json({ id: result.lastID, username, email, role, branch_id, message: 'User registered successfully' })
  } catch (error) {
    if (error.message.includes('UNIQUE') || error.message.includes('unique')) {
      return res.status(400).json({ error: 'Email already exists' })
    }
    res.status(500).json({ error: error.message })
  }
})

export default router
