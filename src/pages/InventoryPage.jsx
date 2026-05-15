import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../store.jsx'
import { formatNumber, formatCurrency } from '../utils.js'

const emptyRow = (item_code = '') => ({
  item_code,
  name: '',
  category: '',
  unit: '',
  reorder_level: '',
})

const emptyEdit = { item_code: '', name: '', category: '', unit: '', reorder_level: '' }

function nextItemCode(items) {
  let max = 0
  for (const item of items) {
    const match = item.item_code?.match(/^ITM(\d+)$/i)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > max) max = n
    }
  }
  return 'ITM' + String(max + 1).padStart(3, '0')
}

function generateCode(items, extraCount = 0) {
  let max = 0
  for (const item of items) {
    const match = item.item_code?.match(/^ITM(\d+)$/i)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > max) max = n
    }
  }
  return 'ITM' + String(max + 1 + extraCount).padStart(3, '0')
}

export default function InventoryPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [modal, setModal] = useState(null)

  // Bulk-add state
  const [bulkRows, setBulkRows] = useState([])
  const [bulkErrors, setBulkErrors] = useState([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkGlobalError, setBulkGlobalError] = useState('')

  // Edit state
  const [editForm, setEditForm] = useState(emptyEdit)
  const [editId, setEditId] = useState(null)
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  function fetchItems() {
    return api.get('/items').then(r => { setItems(r.data); return r.data }).catch(console.error)
  }

  useEffect(() => {
    fetchItems()
    api.get('/categories').then(r => setCategories(r.data)).catch(console.error)
    api.get('/units').then(r => setUnits(r.data)).catch(console.error)
  }, [])

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
    const matchCat = !catFilter || i.category === catFilter
    return matchSearch && matchCat
  })

  // ── Bulk-add modal ──────────────────────────────────────────────────────────

  async function openAdd() {
    setBulkGlobalError('')
    setBulkErrors([])
    setBulkLoading(false)
    // Fetch fresh items to get accurate next code
    const latestItems = await fetchItems() || items
    const firstCode = generateCode(latestItems, 0)
    setBulkRows([emptyRow(firstCode)])
    setModal('add')
  }

  function addBulkRow() {
    setBulkRows(prev => {
      const nextCode = generateCode(items, prev.length)
      return [...prev, emptyRow(nextCode)]
    })
    setBulkErrors(prev => [...prev, ''])
  }

  function removeBulkRow(index) {
    if (bulkRows.length <= 1) return
    setBulkRows(prev => prev.filter((_, i) => i !== index))
    setBulkErrors(prev => prev.filter((_, i) => i !== index))
  }

  function updateBulkRow(index, field, value) {
    setBulkRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  async function handleBulkSubmit(e) {
    e.preventDefault()
    setBulkGlobalError('')
    const newErrors = bulkRows.map(() => '')

    // Client-side validation: name required
    let hasValidationError = false
    bulkRows.forEach((row, i) => {
      if (!row.name.trim()) {
        newErrors[i] = 'Name is required.'
        hasValidationError = true
      }
    })
    if (hasValidationError) { setBulkErrors(newErrors); return }

    setBulkLoading(true)
    setBulkErrors(newErrors)

    let anyFailed = false
    const results = await Promise.allSettled(
      bulkRows.map(row => api.post('/items', {
        item_code: row.item_code,
        name: row.name.trim(),
        category: row.category || null,
        unit: row.unit || null,
        reorder_level: row.reorder_level === '' ? 0 : Number(row.reorder_level),
      }))
    )

    const updatedErrors = bulkRows.map((_, i) => {
      if (results[i].status === 'rejected') {
        anyFailed = true
        return results[i].reason?.response?.data?.error || 'Error saving item.'
      }
      return ''
    })

    setBulkErrors(updatedErrors)
    setBulkLoading(false)

    if (!anyFailed) {
      setModal(null)
      fetchItems()
    } else {
      setBulkGlobalError('Some rows could not be saved. Please review the errors below.')
      // Remove successfully saved rows so user only sees failed ones
      const failedRows = bulkRows.filter((_, i) => results[i].status === 'rejected')
      const failedErrors = updatedErrors.filter((_, i) => results[i].status === 'rejected')
      setBulkRows(failedRows)
      setBulkErrors(failedErrors)
      fetchItems()
    }
  }

  // ── Edit modal ──────────────────────────────────────────────────────────────

  function openEdit(item) {
    setEditForm({
      item_code: item.item_code,
      name: item.name,
      category: item.category || '',
      unit: item.unit || '',
      reorder_level: item.reorder_level ?? '',
    })
    setEditId(item.id)
    setEditError('')
    setModal('edit')
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setEditError('')
    setEditLoading(true)
    try {
      await api.put(`/items/${editId}`, editForm)
      setModal(null)
      fetchItems()
    } catch (err) {
      setEditError(err.response?.data?.error || 'Error saving item')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try { await api.delete(`/items/${item.id}`); fetchItems() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">{isAdmin ? 'Manage all inventory items' : 'View current stock'}</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>}
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ width: 260 }}
          placeholder="Search by name or code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          style={{ width: 180 }}
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Code</th><th>Name</th><th>Category</th><th>Unit</th>
            <th>Low Stock Alert Level</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={isAdmin ? 6 : 5} className="empty-row">No items found.</td></tr>
          )}
          {filtered.map(item => (
            <tr
              key={item.id}
              className={item.current_qty <= item.reorder_level && item.reorder_level > 0 ? 'row-warning' : ''}
            >
              <td><code>{item.item_code}</code></td>
              <td>{item.name}</td>
              <td>{item.category || '—'}</td>
              <td>{item.unit || '—'}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {formatNumber(item.reorder_level, 0)}
                  {item.current_qty <= item.reorder_level && item.reorder_level > 0 && (
                    <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>LOW</span>
                  )}
                </div>
              </td>
              {isAdmin && (
                <td className="actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Bulk-add modal ── */}
      {modal === 'add' && (
        <Modal title="Add Items" onClose={() => setModal(null)}>
          <form onSubmit={handleBulkSubmit}>
            {bulkGlobalError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{bulkGlobalError}</div>}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={thStyle}>Item Code</th>
                    <th style={thStyle}>Name *</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Unit</th>
                    <th style={thStyle}>Reorder Level</th>
                    <th style={{ ...thStyle, width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>
                        <input
                          className="form-input"
                          style={{ width: 90, background: '#F3F4F6', color: '#6B7280', cursor: 'not-allowed' }}
                          value={row.item_code}
                          readOnly
                          tabIndex={-1}
                        />
                      </td>
                      <td style={tdStyle}>
                        <div>
                          <input
                            className="form-input"
                            style={{ width: 160, borderColor: bulkErrors[i] ? '#EF4444' : undefined }}
                            value={row.name}
                            onChange={e => updateBulkRow(i, 'name', e.target.value)}
                            placeholder="Item name"
                          />
                          {bulkErrors[i] && (
                            <div style={{ color: '#EF4444', fontSize: 11, marginTop: 2 }}>{bulkErrors[i]}</div>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <select
                          className="form-input"
                          style={{ width: 130 }}
                          value={row.category}
                          onChange={e => updateBulkRow(i, 'category', e.target.value)}
                        >
                          <option value="">— none —</option>
                          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <select
                          className="form-input"
                          style={{ width: 110 }}
                          value={row.unit}
                          onChange={e => updateBulkRow(i, 'unit', e.target.value)}
                        >
                          <option value="">— none —</option>
                          {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <input
                          className="form-input"
                          style={{ width: 90 }}
                          type="number"
                          min="0"
                          value={row.reorder_level}
                          onChange={e => updateBulkRow(i, 'reorder_level', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          title="Remove row"
                          onClick={() => removeBulkRow(i)}
                          disabled={bulkRows.length <= 1}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: bulkRows.length <= 1 ? 'not-allowed' : 'pointer',
                            color: bulkRows.length <= 1 ? '#D1D5DB' : '#EF4444',
                            fontSize: 16,
                            lineHeight: 1,
                            padding: '2px 4px',
                          }}
                        >
                          &#x2715;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addBulkRow}>
                + Add Row
              </button>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={bulkLoading}>
                {bulkLoading ? 'Saving…' : `Save ${bulkRows.length} Item${bulkRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {modal === 'edit' && (
        <Modal title="Edit Item" onClose={() => setModal(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert alert-error">{editError}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Item Code *</label>
                <input
                  className="form-input"
                  value={editForm.item_code}
                  onChange={e => setEditForm(f => ({ ...f, item_code: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  className="form-input"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-input"
                  value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select
                  className="form-input"
                  value={editForm.unit}
                  onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                >
                  <option value="">Select unit…</option>
                  {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Low Stock Alert Level</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={editForm.reorder_level}
                  onChange={e => setEditForm(f => ({ ...f, reorder_level: e.target.value }))}
                  placeholder="Quantity at which to alert"
                />
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  Set the minimum quantity before this item triggers a low stock alert
                </div>
              </div>
              {editForm.reorder_level && (
                <div className="info-box" style={{ gridColumn: 'span 2', marginTop: 0 }}>
                  Low stock alert will trigger when quantity falls below{' '}
                  <strong>{formatNumber(editForm.reorder_level, 0)} {editForm.unit || 'units'}</strong>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={editLoading}>
                {editLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

const thStyle = {
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 12,
  color: '#374151',
  borderBottom: '1px solid #E5E7EB',
  whiteSpace: 'nowrap',
}

const tdStyle = {
  padding: '6px 8px',
  verticalAlign: 'top',
  borderBottom: '1px solid #F3F4F6',
}
