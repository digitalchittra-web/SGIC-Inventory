import express from 'express'
import { run, get, all } from '../db.js'
import { auth, logAction } from '../middleware.js'

const router = express.Router()

// Helper function to get fiscal year string (e.g., "82/83")
function getFiscalYear() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  // Fiscal year in Nepal starts in July (month 7)
  const fiscalStartYear = currentMonth >= 7 ? currentYear : currentYear - 1
  const fiscalEndYear = fiscalStartYear + 1

  const fy1 = String(fiscalStartYear).slice(-2)
  const fy2 = String(fiscalEndYear).slice(-2)

  return `${fy1}/${fy2}`
}

// GET next reference number
router.get('/next-ref-no', auth, async (req, res) => {
  try {
    const fy = getFiscalYear()

    // Get or create sequence record for this fiscal year
    let seq = await get('SELECT * FROM reference_sequence WHERE fiscal_year = $1', [fy])
    if (!seq) {
      await run('INSERT INTO reference_sequence (fiscal_year, next_sequence) VALUES ($1, 1)', [fy])
      seq = { next_sequence: 1 }
    }

    const refNo = `${String(seq.next_sequence).padStart(5, '0')}/${fy}`
    res.json({ referenceNo: refNo })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/', auth, async (req, res) => {
  try {
    const { fiscalYearId } = req.query
    let sql = `
      SELECT ob.id, ob.quantity, ob.issued_cost, ob.reference_no, ob.authorized_by, ob.created_at, ob.fiscal_year_id,
        i.id AS item_id, i.name AS item_name, i.item_code, i.unit,
        b.id AS branch_id, b.name AS branch_name,
        u.username AS created_by_name
      FROM outbound ob
      JOIN items i ON ob.item_id = i.id
      JOIN branches b ON ob.destination_branch_id = b.id
      LEFT JOIN users u ON ob.created_by = u.id
    `
    const params = []
    if (fiscalYearId) {
      sql += ` WHERE ob.fiscal_year_id = $1`
      params.push(fiscalYearId)
    }
    sql += ` ORDER BY ob.created_at DESC`
    const records = await all(sql, params)
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

    const item = await get('SELECT * FROM items WHERE id = $1', [itemId])
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (parseFloat(item.current_qty) < qty) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${item.current_qty} ${item.unit || 'units'}` })
    }
    const branch = await get('SELECT id FROM branches WHERE id = $1', [destinationBranchId])
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const issuedCost = parseFloat(item.weighted_avg_cost) || 0
    const newQty = parseFloat(item.current_qty) - qty

    // If referenceNo is provided and matches the expected format, increment sequence
    let finalRefNo = referenceNo || null
    if (referenceNo && referenceNo.includes('/')) {
      const fy = getFiscalYear()
      const seq = await get('SELECT * FROM reference_sequence WHERE fiscal_year = $1', [fy])
      if (seq) {
        await run('UPDATE reference_sequence SET next_sequence = next_sequence + 1 WHERE fiscal_year = $1', [fy])
      }
    }

    const activeFY = await get('SELECT id FROM fiscal_years WHERE is_active = 1')
    const result = await run(
      `INSERT INTO outbound (item_id, quantity, destination_branch_id, issued_cost, reference_no, authorized_by, created_by, fiscal_year_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [itemId, qty, destinationBranchId, issuedCost, finalRefNo, req.user.username, req.user.id, activeFY?.id || null]
    )
    await run('UPDATE items SET current_qty = $1 WHERE id = $2', [newQty, itemId])
    await run(
      `INSERT INTO branch_stock (branch_id, item_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (branch_id, item_id) DO UPDATE SET quantity = branch_stock.quantity + $4`,
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
