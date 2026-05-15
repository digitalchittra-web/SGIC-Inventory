import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'

const emptyVendorRow = () => ({
  name: '',
  pan_vat: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
})

const emptyEdit = { name: '', pan_vat: '', contact_person: '', phone: '', email: '', address: '' }

export default function VendorsPage() {
  const [vendors, setVendors] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  // Bulk-add state
  const [bulkRows, setBulkRows] = useState([emptyVendorRow()])
  const [bulkErrors, setBulkErrors] = useState([''])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkGlobalError, setBulkGlobalError] = useState('')

  // Edit state
  const [editForm, setEditForm] = useState(emptyEdit)
  const [editId, setEditId] = useState(null)
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  function fetchVendors() {
    api.get('/vendors').then(r => setVendors(r.data)).catch(console.error)
  }
  useEffect(() => { fetchVendors() }, [])

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase()
    return !q
      || v.name.toLowerCase().includes(q)
      || (v.contact_person || '').toLowerCase().includes(q)
      || (v.phone || '').toLowerCase().includes(q)
      || (v.email || '').toLowerCase().includes(q)
  })

  // ── Bulk-add modal ──────────────────────────────────────────────────────────

  function openAdd() {
    setBulkRows([emptyVendorRow()])
    setBulkErrors([''])
    setBulkGlobalError('')
    setBulkLoading(false)
    setModal('add')
  }

  function addBulkRow() {
    setBulkRows(prev => [...prev, emptyVendorRow()])
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

    const newErrors = bulkRows.map(row => {
      if (!row.name.trim()) return 'Vendor name is required.'
      return ''
    })
    if (newErrors.some(e => e)) { setBulkErrors(newErrors); return }

    setBulkLoading(true)
    setBulkErrors(bulkRows.map(() => ''))

    const results = await Promise.allSettled(
      bulkRows.map(row => api.post('/vendors', {
        name: row.name.trim(),
        pan_vat: row.pan_vat.trim() || null,
        contact_person: row.contact_person.trim() || null,
        phone: row.phone.trim() || null,
        email: row.email.trim() || null,
        address: row.address.trim() || null,
      }))
    )

    let anyFailed = false
    const updatedErrors = results.map(r => {
      if (r.status === 'rejected') {
        anyFailed = true
        return r.reason?.response?.data?.error || 'Error saving vendor.'
      }
      return ''
    })

    setBulkErrors(updatedErrors)
    setBulkLoading(false)

    if (!anyFailed) {
      setModal(null)
      fetchVendors()
    } else {
      setBulkGlobalError('Some rows could not be saved. Please review the errors below.')
      // Keep only failed rows
      const failedRows = bulkRows.filter((_, i) => results[i].status === 'rejected')
      const failedErrors = updatedErrors.filter((_, i) => results[i].status === 'rejected')
      setBulkRows(failedRows)
      setBulkErrors(failedErrors)
      fetchVendors()
    }
  }

  // ── Edit modal ──────────────────────────────────────────────────────────────

  function openEdit(v) {
    setEditForm({
      name: v.name,
      pan_vat: v.pan_vat || '',
      contact_person: v.contact_person || '',
      phone: v.phone || '',
      email: v.email || '',
      address: v.address || '',
    })
    setEditId(v.id)
    setEditError('')
    setModal('edit')
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setEditError('')
    setEditLoading(true)
    try {
      await api.put(`/vendors/${editId}`, editForm)
      setModal(null)
      fetchVendors()
    } catch (err) {
      setEditError(err.response?.data?.error || 'Error saving vendor')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(v) {
    if (!confirm(`Delete vendor "${v.name}"?`)) return
    try { await api.delete(`/vendors/${v.id}`); fetchVendors() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
        <input
          className="form-input"
          style={{ width: 300 }}
          placeholder="Search by name, contact, phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th><th>PAN/VAT</th><th>Contact Person</th>
            <th>Phone</th><th>Email</th><th>Address</th><th>Created</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={8} className="empty-row">No vendors found.</td></tr>
          )}
          {filtered.map(v => (
            <tr key={v.id}>
              <td><strong>{v.name}</strong></td>
              <td>{v.pan_vat || '—'}</td>
              <td>{v.contact_person || '—'}</td>
              <td>{v.phone || '—'}</td>
              <td>{v.email || '—'}</td>
              <td>{v.address || '—'}</td>
              <td>{v.created_at?.slice(0, 10)}</td>
              <td className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(v)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(v)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Bulk-add modal ── */}
      {modal === 'add' && (
        <Modal title="Add Vendors" onClose={() => setModal(null)}>
          <form onSubmit={handleBulkSubmit}>
            {bulkGlobalError && (
              <div className="alert alert-error" style={{ marginBottom: 12 }}>{bulkGlobalError}</div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={thStyle}>Name *</th>
                    <th style={thStyle}>PAN/VAT</th>
                    <th style={thStyle}>Contact Person</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Address</th>
                    <th style={{ ...thStyle, width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>
                        <div>
                          <input
                            className="form-input"
                            style={{ width: 150, borderColor: bulkErrors[i] ? '#EF4444' : undefined }}
                            value={row.name}
                            onChange={e => updateBulkRow(i, 'name', e.target.value)}
                            placeholder="Vendor name"
                          />
                          {bulkErrors[i] && (
                            <div style={{ color: '#EF4444', fontSize: 11, marginTop: 2 }}>{bulkErrors[i]}</div>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <input
                          className="form-input"
                          style={{ width: 110 }}
                          value={row.pan_vat}
                          onChange={e => updateBulkRow(i, 'pan_vat', e.target.value)}
                          placeholder="PAN/VAT"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          className="form-input"
                          style={{ width: 130 }}
                          value={row.contact_person}
                          onChange={e => updateBulkRow(i, 'contact_person', e.target.value)}
                          placeholder="Contact person"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          className="form-input"
                          style={{ width: 110 }}
                          value={row.phone}
                          onChange={e => updateBulkRow(i, 'phone', e.target.value)}
                          placeholder="Phone"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          className="form-input"
                          type="email"
                          style={{ width: 150 }}
                          value={row.email}
                          onChange={e => updateBulkRow(i, 'email', e.target.value)}
                          placeholder="Email"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          className="form-input"
                          style={{ width: 150 }}
                          value={row.address}
                          onChange={e => updateBulkRow(i, 'address', e.target.value)}
                          placeholder="Address"
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
                {bulkLoading ? 'Saving…' : `Save ${bulkRows.length} Vendor${bulkRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {modal === 'edit' && (
        <Modal title="Edit Vendor" onClose={() => setModal(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert alert-error">{editError}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Vendor Name *</label>
                <input
                  className="form-input"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">PAN/VAT</label>
                <input
                  className="form-input"
                  value={editForm.pan_vat}
                  onChange={e => setEditForm(f => ({ ...f, pan_vat: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input
                  className="form-input"
                  value={editForm.contact_person}
                  onChange={e => setEditForm(f => ({ ...f, contact_person: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  className="form-input"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  className="form-input"
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
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
