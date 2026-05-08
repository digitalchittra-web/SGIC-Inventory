import express from 'express'
import { run, get, all } from '../db.js'
import { auth, logAction } from '../middleware.js'

const router = express.Router()

// GET /api/items
router.get('/', auth, async (req, res) => {
  try {
    const items = await all('SELECT * FROM items ORDER BY name')
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/items/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const item = await get('SELECT * FROM items WHERE id = ?', [req.params.id])
    if (!item) return res.status(404).json({ error: 'Item not found' })
    res.json(item)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/items
router.post('/', auth, async (req, res) => {
  try {
    const { item_code, name, category, unit, vendor_id, vendor_name, vendor_contact, reorder_level } = req.body

    if (!item_code || !name || !category || !unit) {
      return res.status(400).json({ error: 'Item code, name, category, and unit are required' })
    }

    // Check for duplicate item code
    const dupCode = await get('SELECT id FROM items WHERE item_code = ?', [item_code])
    if (dupCode) {
      return res.status(400).json({ error: 'Item code already exists' })
    }

    // Check for duplicate name
    const dupName = await get('SELECT id FROM items WHERE name = ?', [name])
    if (dupName) {
      return res.status(400).json({ error: 'Item name already exists' })
    }

    const result = await run(
      `INSERT INTO items (item_code, name, category, unit, vendor_id, vendor_name, vendor_contact, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_code, name, category || null, unit || null, vendor_id || null, vendor_name || null, vendor_contact || null, reorder_level || 0]
    )

    await logAction(req.user.id, 'CREATE', 'item', result.lastID, `Created item: ${name} (${item_code})`)

    res.status(201).json({ id: result.lastID, item_code, name, message: 'Item created successfully' })
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Item code already exists' })
    }
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/items/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { item_code, name, category, unit, vendor_id, vendor_name, vendor_contact, reorder_level } = req.body

    if (!item_code || !name || !category || !unit) {
      return res.status(400).json({ error: 'Item code, name, category, and unit are required' })
    }

    const existing = await get('SELECT * FROM items WHERE id = ?', [id])
    if (!existing) return res.status(404).json({ error: 'Item not found' })

    // Check for duplicate item code (excluding current item)
    const dupCode = await get('SELECT id FROM items WHERE item_code = ? AND id != ?', [item_code, id])
    if (dupCode) {
      return res.status(400).json({ error: 'Item code already exists' })
    }

    // Check for duplicate name (excluding current item)
    const dupName = await get('SELECT id FROM items WHERE name = ? AND id != ?', [name, id])
    if (dupName) {
      return res.status(400).json({ error: 'Item name already exists' })
    }

    await run(
      `UPDATE items SET item_code = ?, name = ?, category = ?, unit = ?, vendor_id = ?, vendor_name = ?, vendor_contact = ?, reorder_level = ? WHERE id = ?`,
      [item_code, name, category || null, unit || null, vendor_id || null, vendor_name || null, vendor_contact || null, reorder_level || 0, id]
    )

    await logAction(req.user.id, 'UPDATE', 'item', id, `Updated item: ${name} (${item_code})`)

    res.json({ message: 'Item updated successfully' })
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Item code already exists' })
    }
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/items/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params

    const item = await get('SELECT * FROM items WHERE id = ?', [id])
    if (!item) return res.status(404).json({ error: 'Item not found' })

    await run('DELETE FROM items WHERE id = ?', [id])

    await logAction(req.user.id, 'DELETE', 'item', id, `Deleted item: ${item.name} (${item.item_code})`)

    res.json({ message: 'Item deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
