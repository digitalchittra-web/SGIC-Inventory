import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../store.jsx'
import { formatNumber } from '../utils.js'

const empty = { itemId: '', quantity: '', unitPrice: '', vendorName: '', invoiceNo: '', invoiceDate: '' }

export default function InboundPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetchRecords() { api.get('/inbound').then(r => setRecords(r.data)).catch(console.error) }
  useEffect(() => {
    fetchRecords()
    api.get('/items').then(r => setItems(r.data)).catch(console.error)
  }, [])

  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    return !q || r.item_name?.toLowerCase().includes(q) || r.item_code?.toLowerCase().includes(q)
      || (r.vendor_name || '').toLowerCase().includes(q) || (r.invoice_no || '').toLowerCase().includes(q)
  })

  function openAdd() { setForm(empty); setEditId(null); setError(''); setModal('add') }
  function openEdit(r) {
    setForm({ itemId: r.item_id, quantity: r.quantity, unitPrice: r.unit_price, vendorName: r.vendor_name || '', invoiceNo: r.invoice_no || '', invoiceDate: r.invoice_date || '' })
    setEditId(r.id); setError(''); setModal('edit')
  }

  function canEdit(r) { return user?.role === 'admin' || r.created_by === user?.id }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (modal === 'add') await api.post('/inbound', form)
      else await api.put(`/inbound/${editId}`, form)
      setModal(null); setForm(empty); fetchRecords()
      api.get('/items').then(r => setItems(r.data))
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving record')
    } finally { setLoading(false) }
  }

  async function handleDelete(r) {
    if (!confirm(`Delete this purchase record for "${r.item_name}"?\nThis will recalculate the stock quantity.`)) return
    try { await api.delete(`/inbound/${r.id}`); fetchRecords() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inbound — Purchases</h1>
          <p className="page-sub">Record stock received from vendors. Cost recorded at actual purchase price.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Record Purchase</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="form-input" style={{ width: 300 }} placeholder="Search by item, vendor, invoice…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Date</th><th>Item</th><th>Qty</th><th>Unit</th>
            <th>Unit Price (Rs)</th><th>Total (Rs)</th><th>Vendor</th><th>Invoice No.</th><th>Recorded By</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={10} className="empty-row">No purchase records found.</td></tr>}
          {filtered.map(r => (
            <tr key={r.id}>
              <td>{r.invoice_date || r.created_at?.slice(0,10)}</td>
              <td>{r.item_name} <span className="item-code">({r.item_code})</span></td>
              <td>{formatNumber(r.quantity, 0)}</td>
              <td>{r.unit}</td>
              <td>{formatNumber(r.unit_price, 2)}</td>
              <td>{formatNumber(r.quantity * r.unit_price, 2)}</td>
              <td>{r.vendor_name || '—'}</td>
              <td>{r.invoice_no || '—'}</td>
              <td>{r.created_by_name || '—'}</td>
              <td className="actions">
                {canEdit(r) ? (
                  <>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r)}>Delete</button>
                  </>
                ) : <span className="text-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title={modal === 'add' ? 'Record Purchase' : 'Edit Purchase'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            {modal === 'edit' && (
              <div className="info-box" style={{ marginBottom: 14 }}>
                Editing this record will recalculate the item's stock quantity and weighted average cost automatically.
              </div>
            )}
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Item *</label>
                <select className="form-input" value={form.itemId} onChange={e => setForm(f => ({...f, itemId: e.target.value}))} required disabled={modal === 'edit'}>
                  <option value="">Select item…</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_code}) — Stock: {i.current_qty} {i.unit}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" min="0.01" step="any" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Price (Rs) *</label>
                <input className="form-input" type="number" min="0" step="any" value={form.unitPrice} onChange={e => setForm(f => ({...f, unitPrice: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Name</label>
                <input className="form-input" value={form.vendorName} onChange={e => setForm(f => ({...f, vendorName: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice No.</label>
                <input className="form-input" value={form.invoiceNo} onChange={e => setForm(f => ({...f, invoiceNo: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input className="form-input" type="date" value={form.invoiceDate} onChange={e => setForm(f => ({...f, invoiceDate: e.target.value}))} />
              </div>
            </div>
            {form.quantity && form.unitPrice && (
              <div className="info-box">
                Total: <strong>Rs {formatNumber(parseFloat(form.quantity || 0) * parseFloat(form.unitPrice || 0), 2)}</strong>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : modal === 'add' ? 'Record Purchase' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
