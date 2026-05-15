import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../store.jsx'

const emptyEdit = { name: '', location: '' }
const newBulkRow = () => ({ id: crypto.randomUUID(), name: '', location: '', error: '' })

export default function BranchesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [branches, setBranches] = useState([])
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

  function fetchBranches() {
    api.get('/branches').then(r => setBranches(r.data)).catch(console.error)
  }
  useEffect(() => { fetchBranches() }, [])

  const filtered = branches.filter(b => {
    const q = search.toLowerCase()
    return !q || b.name.toLowerCase().includes(q) || (b.location || '').toLowerCase().includes(q)
  })

  function openBulkAdd() {
    setBulkRows([newBulkRow()])
    setBulkLoading(false)
    setModal('bulk-add')
  }

  function openEdit(b) {
    setEditForm({ name: b.name, location: b.location || '' })
    setEditId(b.id)
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
        error: r.name.trim() ? '' : 'Branch name is required'
      })))
      return
    }
    setBulkLoading(true)
    const results = await Promise.allSettled(
      bulkRows.map(r => api.post('/branches', { name: r.name.trim(), location: r.location.trim() }))
    )
    const failedRows = bulkRows.filter((_, i) => results[i].status === 'rejected').map((r, i) => {
      const originalIndex = bulkRows.indexOf(r)
      const reason = results[originalIndex]?.reason
      return { ...r, error: reason?.response?.data?.error || 'Failed to save' }
    })

    // Map failures back correctly
    const updatedRows = bulkRows.map((r, i) => {
      if (results[i].status === 'rejected') {
        return { ...r, error: results[i].reason?.response?.data?.error || 'Failed to save' }
      }
      return null
    }).filter(Boolean)

    setBulkLoading(false)
    fetchBranches()

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
      await api.put(`/branches/${editId}`, editForm)
      setModal(null)
      fetchBranches()
    } catch (err) {
      setEditError(err.response?.data?.error || 'Error saving branch')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete(b) {
    if (!confirm(`Delete branch "${b.name}"?`)) return
    try { await api.delete(`/branches/${b.id}`); fetchBranches() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Branches</h1>
          <p className="page-sub">{isAdmin ? 'Manage head office and branch locations' : 'View all branch locations'}</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openBulkAdd}>+ Add Branch</button>}
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ width: 280 }}
          placeholder="Search by name or location…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>#</th><th>Branch Name</th><th>Location</th><th>Created</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={isAdmin ? 5 : 4} className="empty-row">No branches found.</td></tr>
          )}
          {filtered.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td><strong>{b.name}</strong></td>
              <td>{b.location || '—'}</td>
              <td>{b.created_at?.slice(0, 10)}</td>
              {isAdmin && (
                <td className="actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(b)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(b)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bulk Add Modal */}
      {isAdmin && modal === 'bulk-add' && (
        <Modal title="Add Branches" onClose={() => setModal(null)}>
          <form onSubmit={handleBulkSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Branch Name *</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Location</span>
              <span />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {bulkRows.map(row => (
                <div key={row.id}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <input
                      className={`form-input${row.error ? ' input-error' : ''}`}
                      placeholder="Branch name"
                      value={row.name}
                      onChange={e => updateBulkRow(row.id, 'name', e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="City / District"
                      value={row.location}
                      onChange={e => updateBulkRow(row.id, 'location', e.target.value)}
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
                {bulkLoading ? 'Saving…' : `Save ${bulkRows.length > 1 ? `${bulkRows.length} Branches` : 'Branch'}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {isAdmin && modal === 'edit' && (
        <Modal title="Edit Branch" onClose={() => setModal(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert alert-error">{editError}</div>}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Branch Name *</label>
              <input
                className="form-input"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                className="form-input"
                value={editForm.location}
                onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                placeholder="City / District"
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
