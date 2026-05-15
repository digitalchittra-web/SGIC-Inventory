import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [form, setForm] = useState({ name: '' })
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetchDepartments() {
    api.get('/departments').then(r => setDepartments(r.data)).catch(console.error)
  }
  useEffect(() => { fetchDepartments() }, [])

  const filtered = departments.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() { setForm({ name: '' }); setEditId(null); setError(''); setModal('add') }
  function openEdit(d) { setForm({ name: d.name }); setEditId(d.id); setError(''); setModal('edit') }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (modal === 'add') await api.post('/departments', form)
      else await api.put(`/departments/${editId}`, form)
      setModal(null)
      fetchDepartments()
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving department')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(d) {
    if (!confirm(`Delete department "${d.name}"?`)) return
    try { await api.delete(`/departments/${d.id}`); fetchDepartments() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-sub">Manage departments for user assignment</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Department</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ width: 300 }}
          placeholder="Search departments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <table className="table">
        <thead>
          <tr><th>Department Name</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={3} className="empty-row">No departments found.</td></tr>
          )}
          {filtered.map(d => (
            <tr key={d.id}>
              <td><strong>{d.name}</strong></td>
              <td>{d.created_at?.slice(0, 10)}</td>
              <td className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(d)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Department' : 'Edit Department'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Department Name *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Underwriting"
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
