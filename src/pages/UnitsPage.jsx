import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'

const emptyEdit = { name: '', symbol: '' }
const newBulkRow = () => ({ id: crypto.randomUUID(), name: '', symbol: '', error: '' })

export default function UnitsPage() {
  const [units, setUnits] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'bulk-add' | 'edit'

  // Edit state
  const [editForm, setEditForm] = useState(emptyEdit)
  const [editId, setEditId] = useState(null)
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Bulk-add state
  const [bulkRows, setBulkRows] = useState([newBulkRow()])
  const [bulkLoading, setBulkLoading] = useState(false)

  function fetchUnits() {
    api.get('/units').then(r => setUnits(r.data)).catch(console.error)
  }
  useEffect(() => { fetchUnits() }, [])

  const filtered = units.filter(u => {
    const q = search.toLowerCase()
    return !q || u.name.toLowerCase().includes(q) || (u.symbol || '').toLowerCase().includes(q)
  })

  function openBulkAdd() {
    setBulkRows([newBulkRow()])
    setBulkLoading(false)
    setModal('bulk-add')
  }

  function openEdit(u) {
    setEditForm({ name: u.name, symbol: u.symbol || '' })
    setEditId(u.id)
    setEditError('')
    setModal('edit')
  }

  // Bulk-add row helpers
  function addBulkRow() {
    setBulkRows(rows => [...rows, newBulkRow()])
  }

  function removeBulkRow(id) {
    setBulkRows(rows => rows.length > 1 ? rows.filter(r => r.id !== id) : rows)
  }

  function updateBulkRow(id, field, value) {
    setBulkRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value, error: '' } : r))
  }

  async function handleBulkSubmit(e) {
    e.preventDefault()
    const valid = bulkRows.every(r => r.name.trim())
    if (!valid) {
      setBulkRows(rows => rows.map(r => ({
        ...r,
        error: r.name.trim() ? '' : 'Unit name is required'
      })))
      return
    }
    setBulkLoading(true)
    const results = await Promise.allSettled(
      bulkRows.map(r => api.post('/units', { name: r.name.trim(), symbol: r.symbol.trim() }))
    )
    const updatedRows = bulkRows.map((r, i) => {
      if (results[i].status === 'rejected') {
        return { ...r, error: results[i].reason?.response?.data?.error || 'Failed to save' }
      }
      return null
    }).filter(Boolean)

    setBulkLoading(false)
    fetchUnits()

    if (updatedRows.length === 0) {
      setModal(null)
    } else {
      setBulkRows(updatedRows)
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setEditError('')
    setEditLoading(true)
    try {
      await api.put(`/units/${editId}`, editForm)
      setModal(null)
      fetchUnits()
    } catch (err) {
      setEditError(err.response?.data?.error || 'Error saving unit')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Delete unit "${u.name}"?`)) return
    try { await api.delete(`/units/${u.id}`); fetchUnits() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Units of Measure</h1>
          <p className="page-sub">Manage item units (Box, Ream, Piece, etc.)</p>
        </div>
        <button className="btn btn-primary" onClick={openBulkAdd}>+ Add Unit</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ width: 300 }}
          placeholder="Search by name or symbol…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Symbol</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={4} className="empty-row">No units found.</td></tr>
          )}
          {filtered.map(u => (
            <tr key={u.id}>
              <td><strong>{u.name}</strong></td>
              <td><code>{u.symbol || '—'}</code></td>
              <td>{u.created_at?.slice(0, 10)}</td>
              <td className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bulk Add Modal */}
      {modal === 'bulk-add' && (
        <Modal title="Add Units" onClose={() => setModal(null)}>
          <form onSubmit={handleBulkSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Unit Name *</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Symbol</span>
              <span />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {bulkRows.map(row => (
                <div key={row.id}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <input
                      className={`form-input${row.error ? ' input-error' : ''}`}
                      placeholder="e.g., Box, Ream, Piece"
                      value={row.name}
                      onChange={e => updateBulkRow(row.id, 'name', e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="e.g., box, rm, pc"
                      value={row.symbol}
                      onChange={e => updateBulkRow(row.id, 'symbol', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeBulkRow(row.id)}
                      disabled={bulkRows.length === 1}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: bulkRows.length === 1 ? 'not-allowed' : 'pointer',
                        color: bulkRows.length === 1 ? '#ccc' : '#e53e3e',
                        fontSize: 18,
                        lineHeight: 1,
                        padding: '0 4px'
                      }}
                      title="Remove row"
                    >
                      ✕
                    </button>
                  </div>
                  {row.error && (
                    <div style={{ color: '#e53e3e', fontSize: 12, marginTop: 2, paddingLeft: 2 }}>{row.error}</div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={addBulkRow}
              disabled={bulkLoading}
            >
              + Add Row
            </button>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={bulkLoading}>
                {bulkLoading ? 'Saving…' : `Save ${bulkRows.length > 1 ? `${bulkRows.length} Units` : 'Unit'}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {modal === 'edit' && (
        <Modal title="Edit Unit" onClose={() => setModal(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert alert-error">{editError}</div>}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Unit Name *</label>
              <input
                className="form-input"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Box, Ream, Piece, Pack"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Symbol (optional)</label>
              <input
                className="form-input"
                value={editForm.symbol}
                onChange={e => setEditForm(f => ({ ...f, symbol: e.target.value }))}
                placeholder="e.g., box, rm, pc, pk"
              />
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
