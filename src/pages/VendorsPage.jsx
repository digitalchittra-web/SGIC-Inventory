import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'

const empty = { name: '', contact_person: '', phone: '', email: '', address: '' }

export default function VendorsPage() {
  const [vendors, setVendors] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetch() { api.get('/vendors').then(r => setVendors(r.data)).catch(console.error) }
  useEffect(() => { fetch() }, [])

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase()
    return !q || v.name.toLowerCase().includes(q)
      || (v.contact_person || '').toLowerCase().includes(q)
      || (v.phone || '').toLowerCase().includes(q)
      || (v.email || '').toLowerCase().includes(q)
  })

  function openAdd() { setForm(empty); setEditId(null); setError(''); setModal('add') }
  function openEdit(v) {
    setForm({ name: v.name, contact_person: v.contact_person || '', phone: v.phone || '', email: v.email || '', address: v.address || '' })
    setEditId(v.id); setError(''); setModal('edit')
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (modal === 'add') await api.post('/vendors', form)
      else await api.put(`/vendors/${editId}`, form)
      setModal(null); fetch()
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving vendor')
    } finally { setLoading(false) }
  }

  async function handleDelete(v) {
    if (!confirm(`Delete vendor "${v.name}"?`)) return
    try { await api.delete(`/vendors/${v.id}`); fetch() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="page-sub">Manage supplier / vendor directory</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Vendor</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="form-input" style={{ width: 300 }} placeholder="Search by name, contact, phone…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Contact Person</th><th>Phone</th><th>Email</th><th>Address</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={7} className="empty-row">No vendors found.</td></tr>}
          {filtered.map(v => (
            <tr key={v.id}>
              <td><strong>{v.name}</strong></td>
              <td>{v.contact_person || '—'}</td>
              <td>{v.phone || '—'}</td>
              <td>{v.email || '—'}</td>
              <td>{v.address || '—'}</td>
              <td>{v.created_at?.slice(0,10)}</td>
              <td className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(v)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(v)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Vendor' : 'Edit Vendor'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Vendor Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input className="form-input" value={form.contact_person} onChange={e => setForm(f => ({...f, contact_person: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} />
              </div>
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
