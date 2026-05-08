import express from 'express'
import { all } from '../db.js'
import { auth, adminOnly } from '../middleware.js'

const router = express.Router()

router.get('/stock', auth, async (req, res) => {
  try {
    const items = await all(`
      SELECT id, item_code, name, category, unit, current_qty, weighted_avg_cost,
        (current_qty * weighted_avg_cost) AS total_value, reorder_level, vendor_name,
        CASE WHEN current_qty <= reorder_level THEN 1 ELSE 0 END AS low_stock
      FROM items ORDER BY name
    `)
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/transfers', auth, adminOnly, async (req, res) => {
  try {
    const { branchId, itemId, from, to } = req.query
    let sql = `
      SELECT ob.id, ob.quantity, ob.issued_cost, ob.reference_no, ob.authorized_by, ob.created_at,
        i.name AS item_name, i.item_code, i.unit,
        b.name AS branch_name,
        u.username AS created_by_name
      FROM outbound ob
      JOIN items i ON ob.item_id = i.id
      JOIN branches b ON ob.destination_branch_id = b.id
      LEFT JOIN users u ON ob.created_by = u.id
      WHERE 1=1
    `
    const params = []
    if (branchId) { sql += ' AND ob.destination_branch_id = ?'; params.push(branchId) }
    if (itemId) { sql += ' AND ob.item_id = ?'; params.push(itemId) }
    if (from) { sql += ' AND DATE(ob.created_at) >= ?'; params.push(from) }
    if (to) { sql += ' AND DATE(ob.created_at) <= ?'; params.push(to) }
    sql += ' ORDER BY ob.created_at DESC'

    const records = await all(sql, params)
    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/low-stock', auth, adminOnly, async (req, res) => {
  try {
    const items = await all(`
      SELECT id, item_code, name, category, unit, current_qty, reorder_level, vendor_name, vendor_contact
      FROM items WHERE current_qty <= reorder_level ORDER BY current_qty ASC
    `)
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/activity', auth, adminOnly, async (req, res) => {
  try {
    const { userId, action, from, to } = req.query
    let sql = `
      SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.created_at,
        u.username
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `
    const params = []
    if (userId) { sql += ' AND al.user_id = ?'; params.push(userId) }
    if (action) { sql += ' AND al.action = ?'; params.push(action) }
    if (from) { sql += ' AND DATE(al.created_at) >= ?'; params.push(from) }
    if (to) { sql += ' AND DATE(al.created_at) <= ?'; params.push(to) }
    sql += ' ORDER BY al.created_at DESC LIMIT 500'

    const logs = await all(sql, params)
    res.json(logs)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/inbound-history', auth, adminOnly, async (req, res) => {
  try {
    const { itemId, vendorName, from, to } = req.query
    let sql = `
      SELECT ib.id, ib.quantity, ib.unit_price, ib.vendor_name, ib.invoice_no, ib.invoice_date, ib.created_at,
        i.name AS item_name, i.item_code, i.unit,
        u.username AS created_by_name
      FROM inbound ib
      JOIN items i ON ib.item_id = i.id
      LEFT JOIN users u ON ib.created_by = u.id
      WHERE 1=1
    `
    const params = []
    if (itemId) { sql += ' AND ib.item_id = ?'; params.push(itemId) }
    if (vendorName) { sql += ' AND ib.vendor_name LIKE ?'; params.push(`%${vendorName}%`) }
    if (from) { sql += ' AND DATE(COALESCE(ib.invoice_date, ib.created_at)) >= ?'; params.push(from) }
    if (to) { sql += ' AND DATE(COALESCE(ib.invoice_date, ib.created_at)) <= ?'; params.push(to) }
    sql += ' ORDER BY ib.created_at DESC'

    const records = await all(sql, params)
    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
