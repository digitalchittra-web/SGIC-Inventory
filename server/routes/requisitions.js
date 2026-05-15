import express from 'express'
import { run, get, all, query } from '../db.js'
import { auth, adminOnly, logAction } from '../middleware.js'

const router = express.Router()

function getFiscalYear() {
  const now = new Date()
  const m = now.getMonth() + 1
  const y = now.getFullYear()
  const fyStart = m >= 7 ? y : y - 1
  const fy1 = String(fyStart).slice(-2)
  const fy2 = String(fyStart + 1).slice(-2)
  return `${fy1}/${fy2}`
}

async function getNextRefNo() {
  const fy = getFiscalYear()
  let seq = await get('SELECT * FROM reference_sequence WHERE fiscal_year = $1', [fy])
  if (!seq) {
    await run('INSERT INTO reference_sequence (fiscal_year, next_sequence) VALUES ($1, 1)', [fy])
    seq = { next_sequence: 1 }
  }
  const refNo = `REQ-${String(seq.next_sequence).padStart(5, '0')}/${fy}`
  await run('UPDATE reference_sequence SET next_sequence = next_sequence + 1 WHERE fiscal_year = $1', [fy])
  return refNo
}

// GET all requisitions
// Admin: all; Staff: own only
router.get('/', auth, async (req, res) => {
  try {
    const { status, month, year } = req.query
    let sql = `
      SELECT r.id, r.status, r.remarks, r.reference_no, r.created_at, r.approved_at,
        u.username AS requested_by, u.id AS user_id,
        au.username AS approved_by_name,
        COUNT(ri.id) AS item_count
      FROM requisitions r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users au ON r.approved_by = au.id
      LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
    `
    const params = []
    const conditions = []

    if (req.user.role !== 'admin') {
      params.push(req.user.id)
      conditions.push(`r.user_id = $${params.length}`)
    }
    if (status) {
      params.push(status)
      conditions.push(`r.status = $${params.length}`)
    }
    if (month && year) {
      params.push(parseInt(month))
      params.push(parseInt(year))
      conditions.push(`EXTRACT(MONTH FROM r.created_at) = $${params.length - 1} AND EXTRACT(YEAR FROM r.created_at) = $${params.length}`)
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
    sql += ' GROUP BY r.id, u.username, u.id, au.username ORDER BY r.created_at DESC'

    const rows = await all(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET single requisition with items
router.get('/:id', auth, async (req, res) => {
  try {
    const req_ = await get(`
      SELECT r.*, u.username AS requested_by, au.username AS approved_by_name
      FROM requisitions r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users au ON r.approved_by = au.id
      WHERE r.id = $1
    `, [req.params.id])
    if (!req_) return res.status(404).json({ error: 'Not found' })
    if (req.user.role !== 'admin' && req_.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const items = await all(`
      SELECT ri.*, i.current_qty
      FROM requisition_items ri
      JOIN items i ON ri.item_id = i.id
      WHERE ri.requisition_id = $1
    `, [req.params.id])
    res.json({ ...req_, items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST create requisition
router.post('/', auth, async (req, res) => {
  try {
    const { items, remarks } = req.body
    if (!items || items.length === 0) return res.status(400).json({ error: 'At least one item required' })

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.itemId) {
        return res.status(400).json({ error: `Row ${i + 1}: Please select an item` })
      }
      if (!item.quantity || item.quantity === '') {
        return res.status(400).json({ error: `Row ${i + 1}: Please enter a quantity` })
      }
      const qty = parseInt(item.quantity)
      if (isNaN(qty)) {
        return res.status(400).json({ error: `Row ${i + 1}: Quantity must be a number, got "${item.quantity}"` })
      }
      if (qty < 1) {
        return res.status(400).json({ error: `Row ${i + 1}: Quantity must be at least 1` })
      }
    }

    const result = await run(
      `INSERT INTO requisitions (user_id, remarks) VALUES ($1, $2) RETURNING id`,
      [req.user.id, remarks || null]
    )
    const reqId = result.lastID

    if (!reqId) {
      return res.status(500).json({ error: 'Failed to create requisition - database error' })
    }

    for (const item of items) {
      const dbItem = await get('SELECT id, name, item_code, unit FROM items WHERE id = $1', [item.itemId])
      if (!dbItem) continue
      await run(
        `INSERT INTO requisition_items (requisition_id, item_id, item_name, item_code, unit, quantity, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [reqId, dbItem.id, dbItem.name, dbItem.item_code, dbItem.unit || '', parseInt(item.quantity), item.description || null]
      )
    }

    await logAction(req.user.id, 'CREATE', 'requisition', reqId, `Created requisition with ${items.length} item(s)`)
    res.status(201).json({ id: reqId, message: 'Requisition submitted' })
  } catch (err) {
    console.error('Requisition submission error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PUT update requisition (user: pending only; admin: can update item approved_qty)
router.put('/:id', auth, async (req, res) => {
  try {
    const reqRow = await get('SELECT * FROM requisitions WHERE id = $1', [req.params.id])
    if (!reqRow) return res.status(404).json({ error: 'Not found' })

    if (req.user.role !== 'admin') {
      if (reqRow.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
      if (reqRow.status !== 'pending') return res.status(400).json({ error: 'Can only edit pending requisitions' })
    }

    const { items, remarks } = req.body
    await run('UPDATE requisitions SET remarks = $1 WHERE id = $2', [remarks ?? reqRow.remarks, reqRow.id])

    if (items) {
      if (req.user.role === 'admin') {
        // Admin only updates approved_quantity
        for (const item of items) {
          await run('UPDATE requisition_items SET approved_quantity = $1 WHERE id = $2 AND requisition_id = $3',
            [item.approved_quantity !== undefined ? parseInt(item.approved_quantity) : null, item.id, reqRow.id])
        }
      } else {
        // User replaces items
        await run('DELETE FROM requisition_items WHERE requisition_id = $1', [reqRow.id])
        for (const item of items) {
          const dbItem = await get('SELECT id, name, item_code, unit FROM items WHERE id = $1', [item.itemId])
          if (!dbItem) continue
          await run(
            `INSERT INTO requisition_items (requisition_id, item_id, item_name, item_code, unit, quantity, description)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [reqRow.id, dbItem.id, dbItem.name, dbItem.item_code, dbItem.unit || '', parseInt(item.quantity), item.description || null]
          )
        }
      }
    }

    await logAction(req.user.id, 'UPDATE', 'requisition', reqRow.id, 'Updated requisition')
    res.json({ message: 'Updated' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE requisition (user: pending only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const reqRow = await get('SELECT * FROM requisitions WHERE id = $1', [req.params.id])
    if (!reqRow) return res.status(404).json({ error: 'Not found' })
    if (req.user.role !== 'admin' && reqRow.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (reqRow.status !== 'pending') return res.status(400).json({ error: 'Can only delete pending requisitions' })

    await run('DELETE FROM requisitions WHERE id = $1', [reqRow.id])
    await logAction(req.user.id, 'DELETE', 'requisition', reqRow.id, 'Deleted requisition')
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST approve requisition (admin only) → creates outbound for each item
router.post('/:id/approve', auth, adminOnly, async (req, res) => {
  try {
    const reqRow = await get('SELECT * FROM requisitions WHERE id = $1', [req.params.id])
    if (!reqRow) return res.status(404).json({ error: 'Not found' })
    if (reqRow.status !== 'pending') return res.status(400).json({ error: 'Requisition already processed' })

    const reqItems = await all('SELECT * FROM requisition_items WHERE requisition_id = $1', [reqRow.id])
    if (reqItems.length === 0) return res.status(400).json({ error: 'No items in requisition' })

    // Determine destination branch (the requesting user's branch)
    const reqUser = await get('SELECT branch_id FROM users WHERE id = $1', [reqRow.user_id])
    const destinationBranchId = reqUser?.branch_id

    // Get active fiscal year
    const activeFY = await get('SELECT id FROM fiscal_years WHERE is_active = 1')

    // Generate reference number
    const refNo = await getNextRefNo()

    const errors = []
    const validItems = []

    // First pass: validate all items
    for (const ri of reqItems) {
      const approvedQty = ri.approved_quantity !== null && ri.approved_quantity !== undefined
        ? parseInt(ri.approved_quantity)
        : parseInt(ri.quantity)

      if (approvedQty <= 0) continue // skip zero-qty items

      const item = await get('SELECT * FROM items WHERE id = $1', [ri.item_id])
      if (!item) { errors.push(`Item ${ri.item_name} not found`); continue }

      if (parseFloat(item.current_qty) < approvedQty) {
        errors.push(`Insufficient stock for ${ri.item_name}: available ${item.current_qty}, requested ${approvedQty}`)
        continue
      }

      validItems.push({ ri, item, approvedQty })
    }

    // If there are inventory errors, reject the entire approval
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') })
    }

    // Second pass: process only valid items
    for (const { ri, item, approvedQty } of validItems) {

      const issuedCost = parseFloat(item.weighted_avg_cost) || 0
      const newQty = parseFloat(item.current_qty) - approvedQty

      await run(
        `INSERT INTO outbound (item_id, quantity, destination_branch_id, issued_cost, reference_no, authorized_by, created_by, fiscal_year_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ri.item_id, approvedQty, destinationBranchId || 1, issuedCost, refNo, req.user.username, req.user.id, activeFY?.id || null]
      )
      await run('UPDATE items SET current_qty = $1 WHERE id = $2', [newQty, ri.item_id])
      if (destinationBranchId) {
        await run(
          `INSERT INTO branch_stock (branch_id, item_id, quantity) VALUES ($1,$2,$3)
           ON CONFLICT (branch_id, item_id) DO UPDATE SET quantity = branch_stock.quantity + $4`,
          [destinationBranchId, ri.item_id, approvedQty, approvedQty]
        )
      }
    }

    await run(
      'UPDATE requisitions SET status = $1, approved_by = $2, approved_at = NOW(), reference_no = $3 WHERE id = $4',
      ['approved', req.user.id, refNo, reqRow.id]
    )
    await logAction(req.user.id, 'OUTBOUND', 'requisition', reqRow.id, `Approved requisition, ref: ${refNo}`)
    res.json({ message: 'Approved', referenceNo: refNo })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
