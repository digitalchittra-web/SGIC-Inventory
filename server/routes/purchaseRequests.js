import express from 'express'
import { run, get, all } from '../db.js'
import { auth, adminOnly, logAction } from '../middleware.js'

const router = express.Router()

// GET all purchase requests — admin sees all, user_admin sees own
router.get('/', auth, async (req, res) => {
  try {
    let sql = `
      SELECT pr.id, pr.status, pr.remarks, pr.created_at,
        u.username AS requested_by, u.id AS user_id,
        COUNT(pri.id) AS item_count
      FROM purchase_requests pr
      JOIN users u ON pr.user_id = u.id
      LEFT JOIN purchase_request_items pri ON pri.request_id = pr.id
    `
    const params = []
    if (req.user.role !== 'admin') {
      sql += ` WHERE pr.user_id = $1`
      params.push(req.user.id)
    }
    sql += ` GROUP BY pr.id, u.username, u.id ORDER BY pr.created_at DESC`
    const rows = await all(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET single purchase request with items
router.get('/:id', auth, async (req, res) => {
  try {
    const pr = await get(`
      SELECT pr.*, u.username AS requested_by
      FROM purchase_requests pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.id = $1
    `, [req.params.id])
    if (!pr) return res.status(404).json({ error: 'Not found' })
    if (req.user.role !== 'admin' && pr.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const items = await all(`
      SELECT pri.*, i.current_qty
      FROM purchase_request_items pri
      JOIN items i ON pri.item_id = i.id
      WHERE pri.request_id = $1
    `, [req.params.id])
    res.json({ ...pr, items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST create purchase request (user_admin only)
router.post('/', auth, async (req, res) => {
  try {
    if (!['user_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only user_admin can submit purchase requests' })
    }
    const { items, remarks } = req.body
    if (!items || items.length === 0) return res.status(400).json({ error: 'At least one item is required' })

    const result = await run(
      `INSERT INTO purchase_requests (user_id, remarks) VALUES ($1, $2) RETURNING id`,
      [req.user.id, remarks || null]
    )
    const requestId = result.lastID

    for (const item of items) {
      const dbItem = await get('SELECT id, name, item_code, unit FROM items WHERE id = $1', [item.itemId])
      if (!dbItem) continue
      const vendor = item.vendorId ? await get('SELECT id, name FROM vendors WHERE id = $1', [item.vendorId]) : null
      await run(
        `INSERT INTO purchase_request_items (request_id, item_id, item_name, item_code, unit, quantity, unit_price, vendor_id, vendor_name, invoice_no, invoice_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [requestId, dbItem.id, dbItem.name, dbItem.item_code, dbItem.unit || '',
         parseFloat(item.quantity), parseFloat(item.unitPrice),
         vendor?.id || null, vendor?.name || null,
         item.invoiceNo || null, item.invoiceDate || null]
      )
    }

    await logAction(req.user.id, 'CREATE_PURCHASE_REQUEST', 'purchase_request', requestId, `Submitted purchase request #${requestId}`)
    res.status(201).json({ id: requestId, message: 'Purchase request submitted for approval' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST approve purchase request — creates actual inbound records
router.post('/:id/approve', auth, adminOnly, async (req, res) => {
  try {
    const pr = await get('SELECT * FROM purchase_requests WHERE id = $1', [req.params.id])
    if (!pr) return res.status(404).json({ error: 'Not found' })
    if (pr.status !== 'pending') return res.status(400).json({ error: 'Already processed' })

    const items = await all('SELECT * FROM purchase_request_items WHERE request_id = $1', [req.params.id])
    const activeFY = await get('SELECT id FROM fiscal_years WHERE is_active = 1')

    for (const ri of items) {
      const item = await get('SELECT * FROM items WHERE id = $1', [ri.item_id])
      if (!item) continue
      const oldQty = parseFloat(item.current_qty) || 0
      const oldWAC = parseFloat(item.weighted_avg_cost) || 0
      const qty = parseFloat(ri.quantity)
      const price = parseFloat(ri.unit_price)
      const newTotalQty = oldQty + qty
      const newWAC = newTotalQty === 0 ? 0 : (oldQty * oldWAC + qty * price) / newTotalQty

      await run(
        `INSERT INTO inbound (item_id, quantity, unit_price, vendor_id, vendor_name, invoice_no, invoice_date, created_by, fiscal_year_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [ri.item_id, qty, price, ri.vendor_id, ri.vendor_name, ri.invoice_no, ri.invoice_date, pr.user_id, activeFY?.id || null]
      )
      await run('UPDATE items SET current_qty = $1, weighted_avg_cost = $2 WHERE id = $3', [newTotalQty, newWAC, ri.item_id])
    }

    await run(`UPDATE purchase_requests SET status = 'approved' WHERE id = $1`, [req.params.id])
    await logAction(req.user.id, 'APPROVE_PURCHASE_REQUEST', 'purchase_request', pr.id, `Approved purchase request #${pr.id}`)
    res.json({ message: 'Purchase request approved and recorded' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST reject purchase request
router.post('/:id/reject', auth, adminOnly, async (req, res) => {
  try {
    const pr = await get('SELECT * FROM purchase_requests WHERE id = $1', [req.params.id])
    if (!pr) return res.status(404).json({ error: 'Not found' })
    if (pr.status !== 'pending') return res.status(400).json({ error: 'Already processed' })
    await run(`UPDATE purchase_requests SET status = 'rejected' WHERE id = $1`, [req.params.id])
    await logAction(req.user.id, 'REJECT_PURCHASE_REQUEST', 'purchase_request', pr.id, `Rejected purchase request #${pr.id}`)
    res.json({ message: 'Purchase request rejected' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST void approved purchase request — reverses inbound records
router.post('/:id/void', auth, async (req, res) => {
  try {
    if (!['admin', 'user_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' })
    const pr = await get('SELECT * FROM purchase_requests WHERE id = $1', [req.params.id])
    if (!pr) return res.status(404).json({ error: 'Not found' })
    if (pr.status !== 'approved') return res.status(400).json({ error: 'Only approved requests can be voided' })

    const items = await all('SELECT * FROM purchase_request_items WHERE request_id = $1', [req.params.id])
    for (const ri of items) {
      const item = await get('SELECT * FROM items WHERE id = $1', [ri.item_id])
      if (!item) continue
      const oldQty = parseFloat(item.current_qty) || 0
      const qty = parseFloat(ri.quantity)
      const newQty = Math.max(0, oldQty - qty)
      await run('UPDATE items SET current_qty = $1 WHERE id = $2', [newQty, ri.item_id])
      await run(
        `DELETE FROM inbound WHERE id = (
          SELECT id FROM inbound WHERE item_id = $1 AND quantity = $2 AND created_by = $3
          ORDER BY created_at DESC LIMIT 1
        )`,
        [ri.item_id, qty, pr.user_id]
      )
    }

    await run(`UPDATE purchase_requests SET status = 'voided' WHERE id = $1`, [req.params.id])
    await logAction(req.user.id, 'VOID_PURCHASE_REQUEST', 'purchase_request', pr.id, `Voided purchase request #${pr.id}`)
    res.json({ message: 'Purchase request voided and inventory reversed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE purchase request (user_admin own pending only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const pr = await get('SELECT * FROM purchase_requests WHERE id = $1', [req.params.id])
    if (!pr) return res.status(404).json({ error: 'Not found' })
    if (req.user.role !== 'admin' && pr.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    if (pr.status !== 'pending') return res.status(400).json({ error: 'Can only delete pending requests' })
    await run('DELETE FROM purchase_requests WHERE id = $1', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
