import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'

const emptyEdit = { name: '', description: '' }
const newBulkRow = () => ({ id: crypto.randomUUID(), name: '', description: '', error: '' })

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
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

  function fetchCategories() {
    api.get('/categories').then(r => setCategories(r.data)).catch(console.error)
  }
  useEffect(() => { fetchCategories() }, [])

  const filtered = categories.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
  })

  function openBulkAdd() {
    setBulkRows([newBulkRow()])
    setBulkLoading(false)
    setModal('bulk-add')
  }

  function openEdit(c) {
    setEditForm({ name: c.name, description: c.description || '' })
    setEditId(c.id)
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
        error: r.name.trim() ? '' : 'Category name is required'
      })))
      return
    }
    setBulkLoading(true)
    const results = await Promise.allSettled(
      bulkRows.map(r => api.post('/categories', { name: r.name.trim(), description: r.description.trim() }))
    )
    const updatedRows = bulkRows.map((r, i) => {
      if (results[i].status === 'rejected') {
        return { ...r, error: results[i].reason?.response?.data?.error || 'Failed to save' }
      }
      return null
    }).filter(Boolean)

    setBulkLoading(false)
    fetchCategories()

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
      await api.put(`/categories/${editId}`, editForm)
      setModal(null)
      fetchCategories()
    } catch (err) {
      setEditError(err.response?.data?.error || 'Error saving category')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Delete category "${c.name}"?`)) return
    try { await api.delete(`/categories/${c.id}`); fetchCategories() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-sub">Manage item categories (Stationery, Office Equipment, etc.)</p>
        </div>
        <button className="btn btn-primary" onClick={openBulkAdd}>+ Add Category</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ width: 300 }}
          placeholder="Search by name or description…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Description</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={4} className="empty-row">No categories found.</td></tr>
          )}
          {filtered.map(c => (
            <tr key={c.id}>
              <td><strong>{c.name}</strong></td>
              <td>{c.description || '—'}</td>
              <td>{c.created_at?.slice(0, 10)}</td>
              <td className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bulk Add Modal */}
      {modal === 'bulk-add' && (
        <Modal title="Add Categories" onClose={() => setModal(null)}>
          <form onSubmit={handleBulkSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: '8px', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Category Name *</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Description</span>
              <span />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {bulkRows.map(row => (
                <div key={row.id}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 8, alignItems: 'center' }}>
                    <input
                      className={`form-input${row.error ? ' input-error' : ''}`}
                      placeholder="Category name"
                      value={row.name}
                      onChange={e => updateBulkRow(row.id, 'name', e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="What is this category for?"
                      value={row.description}
                      onChange={e => updateBulkRow(row.id, 'description', e.target.value)}
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
                {bulkLoading ? 'Saving…' : `Save ${bulkRows.length > 1 ? `${bulkRows.length} Categories` : 'Category'}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {modal === 'edit' && (
        <Modal title="Edit Category" onClose={() => setModal(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert alert-error">{editError}</div>}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Category Name *</label>
              <input
                className="form-input"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                style={{ minHeight: 80, fontFamily: 'inherit' }}
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this category used for?"
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
