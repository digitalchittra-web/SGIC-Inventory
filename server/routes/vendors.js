import express from 'express'
import { run, get, all } from '../db.js'
import { auth, adminOnly, logAction } from '../middleware.js'

const router = express.Router()

router.get('/', auth, async (req, res) => {
  try {
    const vendors = await all('SELECT * FROM vendors ORDER BY name')
    res.json(vendors)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, contact_person, phone, email, address } = req.body
    if (!name) return res.status(400).json({ error: 'Vendor name is required' })

    const result = await run(
      `INSERT INTO vendors (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)`,
      [name, contact_person || null, phone || null, email || null, address || null]
    )
    await logAction(req.user.id, 'CREATE', 'vendor', result.lastID, `Created vendor: ${name}`)
    res.status(201).json({ id: result.lastID, name, message: 'Vendor created successfully' })
  } catch (error) {
    if (error.message.includes('UNIQUE')) return res.status(400).json({ error: 'Vendor name already exists' })
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { name, contact_person, phone, email, address } = req.body
    if (!name) return res.status(400).json({ error: 'Vendor name is required' })

    const vendor = await get('SELECT id FROM vendors WHERE id = ?', [id])
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' })

    await run(
      `UPDATE vendors SET name = ?, contact_person = ?, phone = ?, email = ?, address = ? WHERE id = ?`,
      [name, contact_person || null, phone || null, email || null, address || null, id]
    )
    await logAction(req.user.id, 'UPDATE', 'vendor', id, `Updated vendor: ${name}`)
    res.json({ message: 'Vendor updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const vendor = await get('SELECT * FROM vendors WHERE id = ?', [id])
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' })

    await run('DELETE FROM vendors WHERE id = ?', [id])
    await logAction(req.user.id, 'DELETE', 'vendor', id, `Deleted vendor: ${vendor.name}`)
    res.json({ message: 'Vendor deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
