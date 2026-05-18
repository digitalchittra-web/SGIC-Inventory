import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'

const empty = { username: '', email: '', password: '', role: 'staff', branch_id: '', department_id: '', active: 1 }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [departments, setDepartments] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetch() { api.get('/users').then(r => setUsers(r.data)).catch(console.error) }
  useEffect(() => {
    fetch()
    api.get('/branches').then(r => setBranches(r.data)).catch(console.error)
    api.get('/departments').then(r => setDepartments(r.data)).catch(console.error)
  }, [])

  function openAdd() { setForm(empty); setEditId(null); setError(''); setModal('add') }
  function openEdit(u) {
    setForm({ username: u.username, email: u.email, password: '', role: u.role, branch_id: u.branch_id || '', department_id: u.department_id || '', active: u.active })
    setEditId(u.id); setError(''); setModal('edit')
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const payload = { ...form, branch_id: form.branch_id || null, department_id: form.department_id || null }
      if (modal === 'add') await api.post('/users', payload)
      else {
        if (!payload.password) delete payload.password
        await api.put(`/users/${editId}`, payload)
      }
      setModal(null); fetch()
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving user')
    } finally { setLoading(false) }
  }

  async function handleDeactivate(u) {
    if (!confirm(`Deactivate user "${u.username}"?`)) return
    try { await api.delete(`/users/${u.id}`); fetch() }
    catch (err) { alert(err.response?.data?.error || 'Failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">Manage system users and their roles</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add User</button>
      </div>

      <table className="table">
        <thead>
          <tr><th>Username</th><th>Email</th><th>Role</th><th>Department</th><th>Branch</th><th>Status</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.length === 0 && <tr><td colSpan={8} className="empty-row">No users found.</td></tr>}
          {users.map(u => (
            <tr key={u.id}>
              <td><strong>{u.username}</strong></td>
              <td>{u.email}</td>
              <td><span className={'badge badge-' + u.role}>{u.role === 'user_admin' ? 'User Admin' : u.role}</span></td>
              <td>{u.department_name || '—'}</td>
              <td>{u.branch_name || '—'}</td>
              <td><span className={'badge ' + (u.active ? 'badge-active' : 'badge-inactive')}>{u.active ? 'Active' : 'Inactive'}</span></td>
              <td>{u.created_at?.slice(0,10)}</td>
              <td className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>Edit</button>
                {u.active ? <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(u)}>Deactivate</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title={modal === 'add' ? 'Add User' : 'Edit User'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input className="form-input" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{modal === 'add' ? 'Password *' : 'New Password (leave blank to keep)'}</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required={modal === 'add'} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                  <option value="staff">Staff</option>
                  <option value="user_admin">User Admin</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-input" value={form.department_id} onChange={e => setForm(f => ({...f, department_id: e.target.value}))}>
                  <option value="">None</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <select className="form-input" value={form.branch_id} onChange={e => setForm(f => ({...f, branch_id: e.target.value}))}>
                  <option value="">None</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {modal === 'edit' && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.active} onChange={e => setForm(f => ({...f, active: parseInt(e.target.value)}))}>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              )}
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
