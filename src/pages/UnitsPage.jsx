import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'

const empty = { name: '', symbol: '' }

export default function UnitsPage() {
  const [units, setUnits] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetch() { api.get('/units').then(r => setUnits(r.data)).catch(console.error) }
  useEffect(() => { fetch() }, [])

  const filtered = units.filter(u => {
    const q = search.toLowerCase()
    return !q || u.name.toLowerCase().includes(q) || (u.symbol || '').toLowerCase().includes(q)
  })

  function openAdd() { setForm(empty); setEditId(null); setError(''); setModal('add') }
  function openEdit(u) { setForm({ name: u.name, symbol: u.symbol || '' }); setEditId(u.id); setError(''); setModal('edit') }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (modal === 'add') await api.post('/units', form)
      else await api.put(`/units/${editId}`, form)
      setModal(null); fetch()
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving unit')
    } finally { setLoading(false) }
  }

  async function handleDelete(u) {
    if (!confirm(`Delete unit "${u.name}"?`)) return
    try { await api.delete(`/units/${u.id}`); fetch() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Units of Measure</h1>
          <p className="page-sub">Manage item units (Box, Ream, Piece, etc.)</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Unit</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="form-input" style={{ width: 300 }} placeholder="Search by name or symbol…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Symbol</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={4} className="empty-row">No units found.</td></tr>}
          {filtered.map(u => (
            <tr key={u.id}>
              <td><strong>{u.name}</strong></td>
              <td><code>{u.symbol || '—'}</code></td>
              <td>{u.created_at?.slice(0,10)}</td>
              <td className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Unit' : 'Edit Unit'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Unit Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g., Box, Ream, Piece, Pack" required />
            </div>
            <div className="form-group">
              <label className="form-label">Symbol (optional)</label>
              <input className="form-input" value={form.symbol} onChange={e => setForm(f => ({...f, symbol: e.target.value}))} placeholder="e.g., box, rm, pc, pk" />
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
