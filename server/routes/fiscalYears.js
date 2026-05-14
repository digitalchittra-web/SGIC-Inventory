import express from 'express'
import { run, get, all } from '../db.js'
import { auth, adminOnly } from '../middleware.js'

const router = express.Router()

// GET all fiscal years
router.get('/', auth, async (req, res) => {
  try {
    const years = await all(`SELECT * FROM fiscal_years ORDER BY created_at DESC`)
    res.json(years)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET active fiscal year
router.get('/active', auth, async (req, res) => {
  try {
    const year = await get(`SELECT * FROM fiscal_years WHERE is_active = 1`)
    res.json(year || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST create new fiscal year (admin only) — archives current and starts fresh
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Fiscal year name is required' })

    const existing = await get('SELECT id FROM fiscal_years WHERE name = $1', [name.trim()])
    if (existing) return res.status(400).json({ error: 'A fiscal year with this name already exists' })

    // Deactivate all current years
    await run(`UPDATE fiscal_years SET is_active = 0`)

    // Create new active fiscal year
    const result = await run(
      `INSERT INTO fiscal_years (name, is_active) VALUES ($1, 1) RETURNING id`,
      [name.trim()]
    )

    res.status(201).json({ id: result.lastID, name: name.trim(), is_active: 1 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT reactivate a fiscal year (undo — makes this year active again)
router.put('/:id/activate', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const year = await get('SELECT * FROM fiscal_years WHERE id = $1', [id])
    if (!year) return res.status(404).json({ error: 'Fiscal year not found' })

    await run(`UPDATE fiscal_years SET is_active = 0`)
    await run(`UPDATE fiscal_years SET is_active = 1 WHERE id = $1`, [id])

    res.json({ message: `Fiscal year "${year.name}" is now active.` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE a fiscal year (admin only) — must not be the active year
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const year = await get('SELECT * FROM fiscal_years WHERE id = $1', [id])
    if (!year) return res.status(404).json({ error: 'Fiscal year not found' })
    if (year.is_active) return res.status(400).json({ error: 'Cannot delete the active fiscal year. Activate another year first.' })

    // Unlink records from this fiscal year (set to NULL)
    await run(`UPDATE inbound SET fiscal_year_id = NULL WHERE fiscal_year_id = $1`, [id])
    await run(`UPDATE outbound SET fiscal_year_id = NULL WHERE fiscal_year_id = $1`, [id])
    await run(`DELETE FROM fiscal_years WHERE id = $1`, [id])

    res.json({ message: `Fiscal year "${year.name}" deleted.` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
