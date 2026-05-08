import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'

const empty = { name: '', description: '' }

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetch() { api.get('/categories').then(r => setCategories(r.data)).catch(console.error) }
  useEffect(() => { fetch() }, [])

  const filtered = categories.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
  })

  function openAdd() { setForm(empty); setEditId(null); setError(''); setModal('add') }
  function openEdit(c) { setForm({ name: c.name, description: c.description || '' }); setEditId(c.id); setError(''); setModal('edit') }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (modal === 'add') await api.post('/categories', form)
      else await api.put(`/categories/${editId}`, form)
      setModal(null); fetch()
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving category')
    } finally { setLoading(false) }
  }

  async function handleDelete(c) {
    if (!confirm(`Delete category "${c.name}"?`)) return
    try { await api.delete(`/categories/${c.id}`); fetch() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-sub">Manage item categories (Stationery, Office Equipment, etc.)</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Category</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="form-input" style={{ width: 300 }} placeholder="Search by name or description…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Description</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={4} className="empty-row">No categories found.</td></tr>}
          {filtered.map(c => (
            <tr key={c.id}>
              <td><strong>{c.name}</strong></td>
              <td>{c.description || '—'}</td>
              <td>{c.created_at?.slice(0,10)}</td>
              <td className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Category' : 'Edit Category'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Category Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" style={{ minHeight: 80, fontFamily: 'inherit' }} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="What is this category used for?" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
