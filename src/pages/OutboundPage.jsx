import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'
import ItemPicker from '../components/ItemPicker.jsx'
import { formatNumber } from '../utils.js'

const emptyRow = { itemId: '', quantity: '' }

export default function OutboundPage() {
  const [records, setRecords] = useState([])
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [modal, setModal] = useState(false)
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [transferRows, setTransferRows] = useState([{ ...emptyRow }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterBranchId, setFilterBranchId] = useState('')
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  function fetchRecords() { api.get('/outbound').then(r => setRecords(r.data)).catch(console.error) }
  useEffect(() => {
    fetchRecords()
    api.get('/items').then(r => setItems(r.data)).catch(console.error)
    api.get('/branches').then(r => setBranches(r.data)).catch(console.error)
  }, [])

  // Filter by date range + branch
  const filtered = records.filter(r => {
    const recordDate = r.created_at?.slice(0, 10)
    const matchFrom = !dateFrom || recordDate >= dateFrom
    const matchTo = !dateTo || recordDate <= dateTo
    const matchBranch = !filterBranchId || String(r.branch_id) === filterBranchId
    return matchFrom && matchTo && matchBranch
  })

  // Group by reference_no; if no reference_no each record is its own group
  const groups = (() => {
    const map = {}
    filtered.forEach(r => {
      const key = r.reference_no ? `ref-${r.reference_no}` : `solo-${r.id}`
      if (!map[key]) {
        map[key] = {
          key,
          reference_no: r.reference_no,
          date: r.created_at?.slice(0, 10),
          branch_name: r.branch_name,
          created_by_name: r.created_by_name,
          items: [],
          total: 0
        }
      }
      map[key].items.push(r)
      map[key].total += (parseFloat(r.quantity) || 0) * (parseFloat(r.issued_cost) || 0)
    })
    return Object.values(map)
  })()

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function generateReferenceNo() {
    try {
      const response = await api.get('/outbound/next-ref-no')
      setReferenceNo(response.data.referenceNo)
    } catch (err) {
      console.error('Error generating reference number:', err)
      setReferenceNo('')
    }
  }

  async function openAdd() {
    setSelectedBranchId('')
    await generateReferenceNo()
    setTransferRows([{ ...emptyRow }])
    setError('')
    setModal(true)
  }

  function updateRow(index, field, value) {
    const newRows = [...transferRows]
    newRows[index][field] = value
    setTransferRows(newRows)
  }

  function addRow() {
    setTransferRows([...transferRows, { ...emptyRow }])
  }

  function removeRow(index) {
    if (transferRows.length > 1) {
      setTransferRows(transferRows.filter((_, i) => i !== index))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!selectedBranchId) {
        setError('Please select a destination branch')
        setLoading(false)
        return
      }

      const validRows = transferRows.filter(r => r.itemId && r.quantity)
      if (validRows.length === 0) {
        setError('Please add at least one item')
        setLoading(false)
        return
      }

      for (const row of validRows) {
        await api.post('/outbound', {
          itemId: row.itemId,
          quantity: parseFloat(row.quantity),
          destinationBranchId: selectedBranchId,
          referenceNo: referenceNo || null
        })
      }

      setModal(false)
      setTransferRows([{ ...emptyRow }])
      fetchRecords()
      api.get('/items').then(r => setItems(r.data))
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating transfers')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Outbound — Transfers</h1>
          <p className="page-sub">Transfer stock from Head Office to branches. Issued at Weighted Average Cost.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Create Transfer</button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ width: 220 }}>
          <ItemPicker
            items={[{ id: '', name: 'All Branches' }, ...branches]}
            value={filterBranchId}
            onChange={v => setFilterBranchId(v === '' ? '' : v)}
            placeholder="Filter by branch…"
            getSubLabel={b => b.location || ''}
          />
        </div>
        <label style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
          From <input type="date" className="form-input" style={{ width: 155 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
          To <input type="date" className="form-input" style={{ width: 155 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </label>
        {(filterBranchId || dateFrom || dateTo) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setFilterBranchId(''); setDateFrom(''); setDateTo('') }}>Clear Filters</button>
        )}
      </div>

      {/* Grouped Table */}
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <th>Date</th>
            <th>Reference No.</th>
            <th>Branch</th>
            <th>Items</th>
            <th>Total Value (Rs)</th>
            <th>Recorded By</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr><td colSpan={7} className="empty-row">No transfer records found.</td></tr>
          )}
          {groups.map(group => (
            <>
              {/* Group header row */}
              <tr
                key={group.key}
                onClick={() => toggleGroup(group.key)}
                style={{ cursor: 'pointer', background: expandedGroups.has(group.key) ? '#eef5ff' : '', fontWeight: 500 }}
              >
                <td style={{ textAlign: 'center', color: '#6b7280', fontSize: 11 }}>
                  {expandedGroups.has(group.key) ? '▼' : '▶'}
                </td>
                <td>{group.date || '—'}</td>
                <td>
                  <code>{group.reference_no || <span style={{ color: '#9ca3af', fontFamily: 'inherit' }}>No Reference</span>}</code>
                </td>
                <td>{group.branch_name || '—'}</td>
                <td>
                  <span className="badge badge-staff">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
                </td>
                <td><strong>Rs {formatNumber(group.total, 2)}</strong></td>
                <td>{group.created_by_name || '—'}</td>
              </tr>

              {/* Expanded item rows */}
              {expandedGroups.has(group.key) && group.items.map(r => (
                <tr key={r.id} style={{ background: '#f8fbff', fontSize: 13 }}>
                  <td></td>
                  <td style={{ color: '#9ca3af', fontSize: 12 }}>{r.created_at?.slice(0, 10)}</td>
                  <td style={{ paddingLeft: 24 }}>
                    {r.item_name} <span className="item-code">({r.item_code})</span>
                  </td>
                  <td style={{ color: '#6b7280' }}>{r.unit}</td>
                  <td>{formatNumber(r.quantity, 0)} × Rs {formatNumber(r.issued_cost, 2)}</td>
                  <td>{formatNumber(r.quantity * r.issued_cost, 2)}</td>
                  <td style={{ color: '#9ca3af' }}>—</td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title="Create Stock Transfer" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Destination Branch *</label>
                <ItemPicker
                  items={branches}
                  value={selectedBranchId}
                  onChange={setSelectedBranchId}
                  placeholder="Select branch…"
                  getSubLabel={b => b.location || ''}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reference No.</label>
                <input className="form-input" value={referenceNo} readOnly style={{ background: '#f5f5f5', color: '#666' }} title="Auto-generated reference number" />
              </div>
            </div>

            <div style={{ marginTop: 20, marginBottom: 20 }}>
              <h3 style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>Transfer Items</h3>
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd', minWidth: 300 }}>Item</th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', width: 100 }}>Qty</th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', width: 120 }}>WAC (Rs)</th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', width: 120 }}>Total (Rs)</th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', width: 60 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferRows.map((row, idx) => {
                      const selectedItem = items.find(i => String(i.id) === row.itemId)
                      const wac = selectedItem?.weighted_avg_cost || 0
                      const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(wac) || 0)

                      let remainingQty = selectedItem?.current_qty || 0
                      for (let i = 0; i < idx; i++) {
                        if (String(transferRows[i].itemId) === String(row.itemId)) {
                          remainingQty -= (parseFloat(transferRows[i].quantity) || 0)
                        }
                      }

                      const selectedItemIds = transferRows
                        .map((r, i) => i !== idx && r.itemId ? String(r.itemId) : null)
                        .filter(Boolean)
                      const availableItems = items.length > 0
                        ? items.filter(i => !selectedItemIds.includes(String(i.id)))
                        : []

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: 8 }}>
                            <ItemPicker
                              items={availableItems}
                              value={row.itemId}
                              onChange={val => updateRow(idx, 'itemId', val)}
                              placeholder="Select item…"
                              getSubLabel={i => `${i.item_code} · Available: ${i.current_qty} ${i.unit || ''}`}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number" min="1" step="1"
                              max={Math.max(0, remainingQty)}
                              value={row.quantity}
                              onChange={e => updateRow(idx, 'quantity', e.target.value)}
                              style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 4 }}
                              placeholder="0"
                            />
                          </td>
                          <td style={{ padding: 8, textAlign: 'center', color: '#666' }}>
                            {formatNumber(wac, 2)}
                          </td>
                          <td style={{ padding: 8, textAlign: 'center', fontWeight: 600 }}>
                            {formatNumber(rowTotal, 2)}
                          </td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            {transferRows.length > 1 && (
                              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeRow(idx)}>✕</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-secondary" onClick={addRow} style={{ marginTop: 10 }}>+ Add Item</button>
            </div>

            {transferRows.some(r => r.itemId && r.quantity) && (
              <div className="info-box" style={{ marginBottom: 20, textAlign: 'right' }}>
                Total Transfer Value: <strong>Rs {formatNumber(
                  transferRows.reduce((sum, row) => {
                    const item = items.find(i => String(i.id) === row.itemId)
                    const qty = parseFloat(row.quantity) || 0
                    const wac = item?.weighted_avg_cost || 0
                    return sum + (qty * wac)
                  }, 0), 2
                )}</strong>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Transferring…' : 'Create Transfers'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
