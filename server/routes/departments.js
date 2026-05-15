import express from 'express'
import { run, get, all } from '../db.js'
import { auth, adminOnly, logAction } from '../middleware.js'

const router = express.Router()

router.get('/', auth, async (req, res) => {
  try {
    const departments = await all('SELECT * FROM departments ORDER BY name')
    res.json(departments)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Department name is required' })

    const dup = await get('SELECT id FROM departments WHERE name = $1', [name])
    if (dup) return res.status(400).json({ error: 'Department name already exists' })

    const result = await run(
      `INSERT INTO departments (name) VALUES ($1) RETURNING id`,
      [name]
    )
    await logAction(req.user.id, 'CREATE', 'department', result.lastID, `Created department: ${name}`)
    res.status(201).json({ id: result.lastID, name })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Department name is required' })

    const dept = await get('SELECT id FROM departments WHERE id = $1', [id])
    if (!dept) return res.status(404).json({ error: 'Department not found' })

    const dup = await get('SELECT id FROM departments WHERE name = $1 AND id != $2', [name, id])
    if (dup) return res.status(400).json({ error: 'Department name already exists' })

    await run(`UPDATE departments SET name = $1 WHERE id = $2`, [name, id])
    await logAction(req.user.id, 'UPDATE', 'department', id, `Updated department: ${name}`)
    res.json({ message: 'Department updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const dept = await get('SELECT * FROM departments WHERE id = $1', [id])
    if (!dept) return res.status(404).json({ error: 'Department not found' })

    await run('DELETE FROM departments WHERE id = $1', [id])
    await logAction(req.user.id, 'DELETE', 'department', id, `Deleted department: ${dept.name}`)
    res.json({ message: 'Department deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
