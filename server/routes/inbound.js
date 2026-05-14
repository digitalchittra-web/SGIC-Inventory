import express from 'express'
import { run, get, all } from '../db.js'
import { auth, logAction } from '../middleware.js'

const router = express.Router()

async function recalcItemFromHistory(itemId) {
  const inbounds = await all('SELECT quantity, unit_price FROM inbound WHERE item_id = $1', [itemId])
  const totalInQty = inbounds.reduce((s, r) => s + r.quantity, 0)
  const totalInValue = inbounds.reduce((s, r) => s + r.quantity * r.unit_price, 0)
  const outbounds = await all('SELECT quantity FROM outbound WHERE item_id = $1', [itemId])
  const totalOutQty = outbounds.reduce((s, r) => s + r.quantity, 0)
  const currentQty = Math.max(0, totalInQty - totalOutQty)
  const wac = totalInQty > 0 ? totalInValue / totalInQty : 0
  await run('UPDATE items SET current_qty = $1, weighted_avg_cost = $2 WHERE id = $3', [currentQty, wac, itemId])
  return { currentQty, wac }
}

router.get('/', auth, async (req, res) => {
  try {
    const { fiscalYearId } = req.query
    let sql = `
      SELECT ib.id, ib.quantity, ib.unit_price, ib.vendor_name, ib.vendor_id, ib.invoice_no, ib.invoice_date, ib.created_at, ib.created_by, ib.fiscal_year_id,
        i.id AS item_id, i.name AS item_name, i.item_code, i.unit,
        u.username AS created_by_name
      FROM inbound ib
      JOIN items i ON ib.item_id = i.id
      LEFT JOIN users u ON ib.created_by = u.id
    `
    const params = []
    if (fiscalYearId) {
      sql += ` WHERE ib.fiscal_year_id = $1`
      params.push(fiscalYearId)
    }
    sql += ` ORDER BY ib.created_at DESC`
    const records = await all(sql, params)
    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', auth, async (req, res) => {
  try {
    const { itemId, quantity, unitPrice, vendorId, invoiceNo, invoiceDate } = req.body
    if (!itemId || !quantity || !unitPrice || !vendorId) return res.status(400).json({ error: 'itemId, quantity, unitPrice, and vendorId are required' })

    const qty = parseFloat(quantity)
    const price = parseFloat(unitPrice)
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' })
    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Unit price must be non-negative' })

    const item = await get('SELECT * FROM items WHERE id = $1', [itemId])
    if (!item) return res.status(404).json({ error: 'Item not found' })

    const vendor = await get('SELECT id, name FROM vendors WHERE id = $1', [vendorId])
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' })

    const oldQty = parseFloat(item.current_qty) || 0
    const oldWAC = parseFloat(item.weighted_avg_cost) || 0
    const newTotalQty = oldQty + qty
    const newWAC = newTotalQty === 0 ? 0 : (oldQty * oldWAC + qty * price) / newTotalQty

    const activeFY = await get('SELECT id FROM fiscal_years WHERE is_active = 1')
    const result = await run(
      `INSERT INTO inbound (item_id, quantity, unit_price, vendor_id, vendor_name, invoice_no, invoice_date, created_by, fiscal_year_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [itemId, qty, price, vendorId, vendor.name, invoiceNo || null, invoiceDate || null, req.user.id, activeFY?.id || null]
    )
    await run('UPDATE items SET current_qty = $1, weighted_avg_cost = $2 WHERE id = $3', [newTotalQty, newWAC, itemId])
    await logAction(req.user.id, 'INBOUND', 'item', itemId,
      `Inbound ${qty} of ${item.name} at Rs ${price}. New WAC: ${newWAC.toFixed(4)}`)

    res.status(201).json({ id: result.lastID, item_name: item.name, quantity: qty, unit_price: price, new_wac: newWAC, new_qty: newTotalQty, message: 'Purchase recorded successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const record = await get('SELECT * FROM inbound WHERE id = $1', [id])
    if (!record) return res.status(404).json({ error: 'Purchase record not found' })

    // Staff can only edit their own records
    if (req.user.role !== 'admin' && record.created_by !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own purchase records' })
    }

    const { quantity, unitPrice, vendorId, invoiceNo, invoiceDate } = req.body
    if (!vendorId) return res.status(400).json({ error: 'vendorId is required' })

    const qty = parseFloat(quantity)
    const price = parseFloat(unitPrice)
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be positive' })
    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Unit price must be non-negative' })

    const vendor = await get('SELECT id, name FROM vendors WHERE id = $1', [vendorId])
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' })

    await run(
      `UPDATE inbound SET quantity = $1, unit_price = $2, vendor_id = $3, vendor_name = $4, invoice_no = $5, invoice_date = $6 WHERE id = $7`,
      [qty, price, vendorId, vendor.name, invoiceNo || null, invoiceDate || null, id]
    )

    const { currentQty, wac } = await recalcItemFromHistory(record.item_id)
    await logAction(req.user.id, 'EDIT_INBOUND', 'inbound', id,
      `Edited purchase record #${id}. Item qty now ${currentQty}, WAC ${wac.toFixed(4)}`)

    res.json({ message: 'Purchase record updated successfully', new_qty: currentQty, new_wac: wac })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const record = await get('SELECT * FROM inbound WHERE id = $1', [id])
    if (!record) return res.status(404).json({ error: 'Purchase record not found' })

    if (req.user.role !== 'admin' && record.created_by !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own purchase records' })
    }

    await run('DELETE FROM inbound WHERE id = $1', [id])
    const { currentQty, wac } = await recalcItemFromHistory(record.item_id)
    await logAction(req.user.id, 'DELETE_INBOUND', 'inbound', id,
      `Deleted purchase record #${id}. Item qty recalculated to ${currentQty}`)

    res.json({ message: 'Purchase record deleted. Stock recalculated.', new_qty: currentQty, new_wac: wac })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
