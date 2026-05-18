import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'
import ItemPicker from '../components/ItemPicker.jsx'
import { useAuth } from '../store.jsx'
import { formatNumber } from '../utils.js'
import { SortTh, sortRows, makeOnSort } from '../components/SortTh.jsx'

const emptyRow = { itemId: '', quantity: '', unitPrice: '' }

export default function InboundPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterVendorId, setFilterVendorId] = useState('')
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const onSort = makeOnSort(sortCol, setSortCol, sortDir, setSortDir)
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [purchaseRows, setPurchaseRows] = useState([{ ...emptyRow }])
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetchRecords() { api.get('/inbound').then(r => setRecords(r.data)).catch(console.error) }
  useEffect(() => {
    fetchRecords()
    api.get('/items').then(r => setItems(r.data)).catch(console.error)
    api.get('/vendors').then(r => setVendors(r.data)).catch(console.error)
  }, [])

  // Filter records by search + date range + vendor
  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || r.item_name?.toLowerCase().includes(q) || r.item_code?.toLowerCase().includes(q)
      || (r.vendor_name || '').toLowerCase().includes(q) || (r.invoice_no || '').toLowerCase().includes(q)
    const recordDate = r.invoice_date || r.created_at?.slice(0, 10)
    const matchFrom = !dateFrom || recordDate >= dateFrom
    const matchTo = !dateTo || recordDate <= dateTo
    const matchVendor = !filterVendorId || String(r.vendor_id) === filterVendorId
    return matchSearch && matchFrom && matchTo && matchVendor
  })

  // Group records by invoice_no + vendor. If no invoice_no, each record is its own group.
  const groups = (() => {
    const map = {}
    filtered.forEach(r => {
      const key = r.invoice_no ? `inv-${r.invoice_no}-${r.vendor_id}` : `solo-${r.id}`
      if (!map[key]) {
        map[key] = {
          key,
          invoice_no: r.invoice_no,
          date: r.invoice_date || r.created_at?.slice(0, 10),
          vendor_name: r.vendor_name,
          vendor_id: r.vendor_id,
          created_by_name: r.created_by_name,
          items: [],
          total: 0
        }
      }
      map[key].items.push(r)
      map[key].total += (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0)
    })
    return sortRows(Object.values(map), sortCol, sortDir)
  })()

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function openAdd() {
    setSelectedVendorId('')
    setInvoiceNo('')
    setInvoiceDate('')
    setPurchaseRows([{ ...emptyRow }])
    setEditId(null)
    setError('')
    setModal('add')
  }

  function openEdit(r) {
    setSelectedVendorId(r.vendor_id || '')
    setInvoiceNo(r.invoice_no || '')
    setInvoiceDate(r.invoice_date || '')
    setPurchaseRows([{ itemId: r.item_id, quantity: r.quantity, unitPrice: r.unit_price }])
    setEditId(r.id)
    setError('')
    setModal('edit')
  }

  function canEdit(r) { return user?.role === 'admin' || r.created_by === user?.id }

  function updateRow(index, field, value) {
    const newRows = [...purchaseRows]
    newRows[index][field] = value
    setPurchaseRows(newRows)
  }

  function addRow() {
    setPurchaseRows([...purchaseRows, { ...emptyRow }])
  }

  function removeRow(index) {
    if (purchaseRows.length > 1) {
      setPurchaseRows(purchaseRows.filter((_, i) => i !== index))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!selectedVendorId) {
        setError('Please select a vendor')
        setLoading(false)
        return
      }

      const validRows = purchaseRows.filter(r => r.itemId && r.quantity && r.unitPrice)
      if (validRows.length === 0) {
        setError('Please add at least one item')
        setLoading(false)
        return
      }

      if (modal === 'add') {
        if (user?.role === 'user_admin') {
          // user_admin: submit as purchase request for admin approval
          await api.post('/purchase-requests', {
            items: validRows.map(row => ({
              itemId: row.itemId,
              quantity: parseFloat(row.quantity),
              unitPrice: parseFloat(row.unitPrice),
              vendorId: selectedVendorId,
              invoiceNo: invoiceNo || null,
              invoiceDate: invoiceDate || null,
            })),
            remarks: invoiceNo ? `Invoice: ${invoiceNo}` : null,
          })
        } else {
          for (const row of validRows) {
            await api.post('/inbound', {
              itemId: row.itemId,
              quantity: parseFloat(row.quantity),
              unitPrice: parseFloat(row.unitPrice),
              vendorId: selectedVendorId,
              invoiceNo: invoiceNo || null,
              invoiceDate: invoiceDate || null
            })
          }
        }
      } else {
        await api.put(`/inbound/${editId}`, {
          quantity: parseFloat(validRows[0].quantity),
          unitPrice: parseFloat(validRows[0].unitPrice),
          vendorId: selectedVendorId,
          invoiceNo: invoiceNo || null,
          invoiceDate: invoiceDate || null
        })
      }

      setModal(null)
      setPurchaseRows([{ ...emptyRow }])
      fetchRecords()
      api.get('/items').then(r => setItems(r.data))
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving records')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(r) {
    if (!confirm(`Delete this purchase record for "${r.item_name}"?\nThis will recalculate the stock quantity.`)) return
    try { await api.delete(`/inbound/${r.id}`); fetchRecords() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  const totalAmount = purchaseRows.reduce((sum, row) => {
    const qty = parseFloat(row.quantity) || 0
    const price = parseFloat(row.unitPrice) || 0
    return sum + (qty * price)
  }, 0)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inbound — Purchases</h1>
          <p className="page-sub">Record stock received from vendors. Cost recorded at actual purchase price.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Record Purchase</button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ width: 220 }} placeholder="Search by item, invoice…" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ width: 220 }}>
          <ItemPicker
            items={[{ id: '', name: 'All Vendors' }, ...vendors]}
            value={filterVendorId}
            onChange={v => setFilterVendorId(v === '' ? '' : v)}
            placeholder="Filter by vendor…"
            getSubLabel={v => v.pan_vat ? `PAN/VAT: ${v.pan_vat}` : ''}
          />
        </div>
        <label style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
          From <input type="date" className="form-input" style={{ width: 155 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
          To <input type="date" className="form-input" style={{ width: 155 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </label>
        {(filterVendorId || dateFrom || dateTo) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setFilterVendorId(''); setDateFrom(''); setDateTo('') }}>Clear Filters</button>
        )}
      </div>

      {/* Grouped Table */}
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <SortTh col="date" label="Date" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh col="vendor_name" label="Vendor" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh col="invoice_no" label="Invoice No." sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <th>Items</th>
            <SortTh col="total" label="Total Amount (Rs)" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh col="created_by_name" label="Recorded By" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr><td colSpan={7} className="empty-row">No purchase records found.</td></tr>
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
                <td>{group.vendor_name || '—'}</td>
                <td>{group.invoice_no || <span style={{ color: '#9ca3af' }}>No Invoice</span>}</td>
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
                  <td style={{ color: '#9ca3af', fontSize: 12 }}>{r.invoice_date || r.created_at?.slice(0, 10)}</td>
                  <td style={{ paddingLeft: 24 }}>
                    {r.item_name} <span className="item-code">({r.item_code})</span>
                  </td>
                  <td style={{ color: '#6b7280' }}>{r.unit}</td>
                  <td>{formatNumber(r.quantity, 0)} × Rs {formatNumber(r.unit_price, 2)}</td>
                  <td>{formatNumber(r.quantity * r.unit_price, 2)}</td>
                  <td className="actions">
                    {canEdit(r) ? (
                      <>
                        <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); openEdit(r) }}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleDelete(r) }}>Delete</button>
                      </>
                    ) : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title={modal === 'add' ? (user?.role === 'user_admin' ? 'Submit Purchase Request' : 'Record Multiple Purchases') : 'Edit Purchase'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            {modal === 'edit' && (
              <div className="info-box" style={{ marginBottom: 14 }}>
                Editing this record will recalculate the item's stock quantity and weighted average cost automatically.
              </div>
            )}

            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Vendor *</label>
                <ItemPicker
                  items={vendors}
                  value={selectedVendorId}
                  onChange={setSelectedVendorId}
                  placeholder="Select vendor…"
                  getSubLabel={v => v.pan_vat ? `PAN/VAT: ${v.pan_vat}` : ''}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice No.</label>
                <input className="form-input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input className="form-input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: 20, marginBottom: 20 }}>
              <h3 style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>Purchase Items</h3>
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #ddd', minWidth: 300 }}>Item</th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', width: 100 }}>Qty</th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', width: 120 }}>Unit Price (Rs)</th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', width: 120 }}>Total (Rs)</th>
                      <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #ddd', width: 60 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseRows.map((row, idx) => {
                      const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitPrice) || 0)
                      const selectedItemIds = purchaseRows
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
                              disabled={modal === 'edit'}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input type="number" min="1" step="1" value={row.quantity}
                              onChange={e => updateRow(idx, 'quantity', e.target.value)}
                              style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 4 }} placeholder="0" />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input type="number" min="0" step="any" value={row.unitPrice}
                              onChange={e => updateRow(idx, 'unitPrice', e.target.value)}
                              style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 4 }} placeholder="0" />
                          </td>
                          <td style={{ padding: 8, textAlign: 'center', fontWeight: 600 }}>{formatNumber(rowTotal, 2)}</td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            {purchaseRows.length > 1 && (
                              <button type="button" className="btn btn-sm btn-danger" onClick={() => removeRow(idx)}>✕</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {modal === 'add' && (
                <button type="button" className="btn btn-secondary" onClick={addRow} style={{ marginTop: 10 }}>+ Add Item</button>
              )}
            </div>

            <div className="info-box" style={{ marginBottom: 20, textAlign: 'right' }}>
              Total Amount: <strong>Rs {formatNumber(totalAmount, 2)}</strong>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving…' : modal === 'add' ? (user?.role === 'user_admin' ? 'Submit for Approval' : 'Record Purchases') : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
