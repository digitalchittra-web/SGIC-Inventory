import express from 'express'
import { run, get, all } from '../db.js'
import { auth, logAction } from '../middleware.js'

const router = express.Router()

router.get('/', auth, async (req, res) => {
  try {
    const records = await all(`
      SELECT ob.id, ob.quantity, ob.issued_cost, ob.reference_no, ob.authorized_by, ob.created_at,
        i.id AS item_id, i.name AS item_name, i.item_code, i.unit,
        b.id AS branch_id, b.name AS branch_name,
        u.username AS created_by_name
      FROM outbound ob
      JOIN items i ON ob.item_id = i.id
      JOIN branches b ON ob.destination_branch_id = b.id
      LEFT JOIN users u ON ob.created_by = u.id
      ORDER BY ob.created_at DESC
    `)
    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', auth, async (req, res) => {
  try {
    const { itemId, quantity, destinationBranchId, referenceNo } = req.body
    if (!itemId || !quantity || !destinationBranchId) {
      return res.status(400).json({ error: 'itemId, quantity, and destinationBranchId are required' })
    }
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' })

    const item = await get('SELECT * FROM items WHERE id = ?', [itemId])
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (parseFloat(item.current_qty) < qty) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${item.current_qty} ${item.unit || 'units'}` })
    }
    const branch = await get('SELECT id FROM branches WHERE id = ?', [destinationBranchId])
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const issuedCost = parseFloat(item.weighted_avg_cost) || 0
    const newQty = parseFloat(item.current_qty) - qty

    const result = await run(
      `INSERT INTO outbound (item_id, quantity, destination_branch_id, issued_cost, reference_no, authorized_by, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [itemId, qty, destinationBranchId, issuedCost, referenceNo || null, req.user.username, req.user.id]
    )
    await run('UPDATE items SET current_qty = ? WHERE id = ?', [newQty, itemId])
    await run(
      `INSERT INTO branch_stock (branch_id, item_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT(branch_id, item_id) DO UPDATE SET quantity = quantity + ?`,
      [destinationBranchId, itemId, qty, qty]
    )
    await logAction(req.user.id, 'OUTBOUND', 'item', itemId,
      `Transferred ${qty} of ${item.name} to branch ${destinationBranchId} at WAC ${issuedCost}`)

    res.status(201).json({ id: result.lastID, item_name: item.name, quantity: qty, issued_cost: issuedCost, new_qty: newQty, message: 'Transfer recorded successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
