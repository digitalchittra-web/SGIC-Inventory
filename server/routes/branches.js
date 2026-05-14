import express from 'express'
import { run, get, all } from '../db.js'
import { auth, adminOnly, logAction } from '../middleware.js'

const router = express.Router()

// GET /api/branches
router.get('/', auth, async (req, res) => {
  try {
    const branches = await all('SELECT * FROM branches ORDER BY name')
    res.json(branches)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/branches
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, location } = req.body
    if (!name) return res.status(400).json({ error: 'Branch name is required' })

    const result = await run(
      `INSERT INTO branches (name, location) VALUES ($1, $2) RETURNING id`,
      [name, location || null]
    )

    await logAction(req.user.id, 'CREATE', 'branch', result.lastID, `Created branch: ${name}`)

    res.status(201).json({ id: result.lastID, name, location: location || null, message: 'Branch created successfully' })
  } catch (error) {
    if (error.message.includes('UNIQUE') || error.message.includes('unique')) {
      return res.status(400).json({ error: 'Branch name already exists' })
    }
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/branches/:id
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, location } = req.body
    const { id } = req.params
    if (!name) return res.status(400).json({ error: 'Branch name is required' })

    const branch = await get('SELECT id FROM branches WHERE id = $1', [id])
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    await run(`UPDATE branches SET name = $1, location = $2 WHERE id = $3`, [name, location || null, id])

    await logAction(req.user.id, 'UPDATE', 'branch', id, `Updated branch to: ${name}`)

    res.json({ message: 'Branch updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/branches/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params

    const branch = await get('SELECT * FROM branches WHERE id = $1', [id])
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    // Check for outbound transfers referencing this branch
    const usedInOutbound = await get('SELECT id FROM outbound WHERE destination_branch_id = $1 LIMIT 1', [id])
    if (usedInOutbound) {
      return res.status(400).json({ error: 'Cannot delete branch: it has outbound transfer records' })
    }

    await run('DELETE FROM branch_stock WHERE branch_id = $1', [id])
    await run('DELETE FROM branches WHERE id = $1', [id])

    await logAction(req.user.id, 'DELETE', 'branch', id, `Deleted branch: ${branch.name}`)

    res.json({ message: 'Branch deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
