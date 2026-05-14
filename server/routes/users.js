import express from 'express'
import bcrypt from 'bcryptjs'
import { run, get, all } from '../db.js'
import { auth, adminOnly, logAction } from '../middleware.js'

const router = express.Router()

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const users = await all(`
      SELECT u.id, u.username, u.email, u.role, u.active, u.created_at, b.name AS branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      ORDER BY u.username
    `)
    res.json(users)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { username, email, password, role = 'staff', branch_id = null } = req.body
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' })
    }
    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or staff' })
    }
    const hashed = await bcrypt.hash(password, 10)
    const result = await run(
      `INSERT INTO users (username, email, password, role, branch_id) VALUES (?, ?, ?, ?, ?)`,
      [username, email, hashed, role, branch_id]
    )
    await logAction(req.user.id, 'CREATE_USER', 'user', result.lastID, `Created user: ${username}`)
    res.status(201).json({ id: result.lastID, username, email, role, message: 'User created successfully' })
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email already exists' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { username, email, password, role, branch_id, active } = req.body

    const user = await get('SELECT * FROM users WHERE id = ?', [id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    let hashedPassword = user.password
    if (password) hashedPassword = await bcrypt.hash(password, 10)

    await run(
      `UPDATE users SET username = ?, email = ?, password = ?, role = ?, branch_id = ?, active = ? WHERE id = ?`,
      [username || user.username, email || user.email, hashedPassword,
        role || user.role, branch_id ?? user.branch_id, active ?? user.active, id]
    )
    await logAction(req.user.id, 'UPDATE_USER', 'user', id, `Updated user: ${username || user.username}`)
    res.json({ message: 'User updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' })
    }
    const user = await get('SELECT * FROM users WHERE id = ?', [id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    await run('UPDATE users SET active = 0 WHERE id = ?', [id])
    await logAction(req.user.id, 'DEACTIVATE_USER', 'user', id, `Deactivated user: ${user.username}`)
    res.json({ message: 'User deactivated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
