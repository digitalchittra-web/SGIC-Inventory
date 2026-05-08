import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../store.jsx'

const empty = { name: '', location: '' }

export default function BranchesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [branches, setBranches] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetch() { api.get('/branches').then(r => setBranches(r.data)).catch(console.error) }
  useEffect(() => { fetch() }, [])

  const filtered = branches.filter(b => {
    const q = search.toLowerCase()
    return !q || b.name.toLowerCase().includes(q) || (b.location || '').toLowerCase().includes(q)
  })

  function openAdd() { setForm(empty); setEditId(null); setError(''); setModal('add') }
  function openEdit(b) { setForm({ name: b.name, location: b.location || '' }); setEditId(b.id); setError(''); setModal('edit') }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (modal === 'add') await api.post('/branches', form)
      else await api.put(`/branches/${editId}`, form)
      setModal(null); fetch()
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving branch')
    } finally { setLoading(false) }
  }

  async function handleDelete(b) {
    if (!confirm(`Delete branch "${b.name}"?`)) return
    try { await api.delete(`/branches/${b.id}`); fetch() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Branches</h1>
          <p className="page-sub">{isAdmin ? 'Manage head office and branch locations' : 'View all branch locations'}</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openAdd}>+ Add Branch</button>}
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="form-input" style={{ width: 280 }} placeholder="Search by name or location…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>#</th><th>Branch Name</th><th>Location</th><th>Created</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={isAdmin ? 5 : 4} className="empty-row">No branches found.</td></tr>}
          {filtered.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td><strong>{b.name}</strong></td>
              <td>{b.location || '—'}</td>
              <td>{b.created_at?.slice(0,10)}</td>
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

      {isAdmin && modal && (
        <Modal title={modal === 'add' ? 'Add Branch' : 'Edit Branch'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Branch Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} placeholder="City / District" />
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
