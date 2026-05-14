import express from 'express'
import { run, get, all } from '../db.js'
import { auth, adminOnly, logAction } from '../middleware.js'

const router = express.Router()

router.get('/', auth, async (req, res) => {
  try {
    const units = await all('SELECT * FROM units ORDER BY name')
    res.json(units)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, symbol } = req.body
    if (!name) return res.status(400).json({ error: 'Unit name is required' })

    const dup = await get('SELECT id FROM units WHERE name = $1', [name])
    if (dup) return res.status(400).json({ error: 'Unit name already exists' })

    const result = await run(
      `INSERT INTO units (name, symbol) VALUES ($1, $2) RETURNING id`,
      [name, symbol || null]
    )
    await logAction(req.user.id, 'CREATE', 'unit', result.lastID, `Created unit: ${name}`)
    res.status(201).json({ id: result.lastID, name, symbol, message: 'Unit created successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { name, symbol } = req.body
    if (!name) return res.status(400).json({ error: 'Unit name is required' })

    const unit = await get('SELECT id FROM units WHERE id = $1', [id])
    if (!unit) return res.status(404).json({ error: 'Unit not found' })

    const dup = await get('SELECT id FROM units WHERE name = $1 AND id != $2', [name, id])
    if (dup) return res.status(400).json({ error: 'Unit name already exists' })

    await run(
      `UPDATE units SET name = $1, symbol = $2 WHERE id = $3`,
      [name, symbol || null, id]
    )
    await logAction(req.user.id, 'UPDATE', 'unit', id, `Updated unit: ${name}`)
    res.json({ message: 'Unit updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const unit = await get('SELECT * FROM units WHERE id = $1', [id])
    if (!unit) return res.status(404).json({ error: 'Unit not found' })

    await run('DELETE FROM units WHERE id = $1', [id])
    await logAction(req.user.id, 'DELETE', 'unit', id, `Deleted unit: ${unit.name}`)
    res.json({ message: 'Unit deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
