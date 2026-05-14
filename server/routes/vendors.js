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
    const { name, pan_vat, contact_person, phone, email, address } = req.body
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Vendor name is required' })
    if (!pan_vat || pan_vat.trim() === '') return res.status(400).json({ error: 'PAN/VAT is required' })

    const result = await run(
      `INSERT INTO vendors (name, pan_vat, contact_person, phone, email, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name.trim(), pan_vat.trim(), contact_person || null, phone || null, email || null, address || null]
    )
    await logAction(req.user.id, 'CREATE', 'vendor', result.lastID, `Created vendor: ${name}`)
    res.status(201).json({ id: result.lastID, name, message: 'Vendor created successfully' })
  } catch (error) {
    if (error.message.includes('vendors_name') || error.message.includes('vendors.name')) return res.status(400).json({ error: 'Vendor name already exists' })
    if (error.message.includes('vendors_pan_vat') || error.message.includes('vendors.pan_vat')) return res.status(400).json({ error: 'PAN/VAT already exists' })
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { name, pan_vat, contact_person, phone, email, address } = req.body
    if (!name) return res.status(400).json({ error: 'Vendor name is required' })
    if (!pan_vat || pan_vat.trim() === '') return res.status(400).json({ error: 'PAN/VAT is required' })

    const vendor = await get('SELECT id FROM vendors WHERE id = $1', [id])
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' })

    await run(
      `UPDATE vendors SET name = $1, pan_vat = $2, contact_person = $3, phone = $4, email = $5, address = $6 WHERE id = $7`,
      [name, pan_vat.trim(), contact_person || null, phone || null, email || null, address || null, id]
    )
    await logAction(req.user.id, 'UPDATE', 'vendor', id, `Updated vendor: ${name}`)
    res.json({ message: 'Vendor updated successfully' })
  } catch (error) {
    if (error.message.includes('vendors_name') || error.message.includes('vendors.name')) return res.status(400).json({ error: 'Vendor name already exists' })
    if (error.message.includes('vendors_pan_vat') || error.message.includes('vendors.pan_vat')) return res.status(400).json({ error: 'PAN/VAT already exists' })
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const vendor = await get('SELECT * FROM vendors WHERE id = $1', [id])
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' })

    await run('DELETE FROM vendors WHERE id = $1', [id])
    await logAction(req.user.id, 'DELETE', 'vendor', id, `Deleted vendor: ${vendor.name}`)
    res.json({ message: 'Vendor deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
