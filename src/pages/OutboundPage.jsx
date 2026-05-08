import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'
import { formatNumber } from '../utils.js'

const empty = { itemId: '', quantity: '', destinationBranchId: '', referenceNo: '' }

export default function OutboundPage() {
  const [records, setRecords] = useState([])
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [selectedItem, setSelectedItem] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetch() { api.get('/outbound').then(r => setRecords(r.data)).catch(console.error) }
  useEffect(() => {
    fetch()
    api.get('/items').then(r => setItems(r.data)).catch(console.error)
    api.get('/branches').then(r => setBranches(r.data)).catch(console.error)
  }, [])

  function handleItemChange(e) {
    const id = e.target.value
    const item = items.find(i => String(i.id) === id) || null
    setForm(f => ({...f, itemId: id}))
    setSelectedItem(item)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      await api.post('/outbound', form)
      setModal(false); setForm(empty); setSelectedItem(null); fetch()
      api.get('/items').then(r => setItems(r.data))
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating transfer')
    } finally { setLoading(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Outbound — Transfers</h1>
          <p className="page-sub">Transfer stock from Head Office to branches. Issued at Weighted Average Cost.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setSelectedItem(null); setError(''); setModal(true) }}>+ Create Transfer</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Date</th><th>Item</th><th>Qty</th><th>Unit</th>
            <th>Issued Cost (WAC)</th><th>Total Value</th>
            <th>Destination Branch</th><th>Reference</th><th>Authorized By</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && <tr><td colSpan={9} className="empty-row">No transfer records found.</td></tr>}
          {records.map(r => (
            <tr key={r.id}>
              <td>{r.created_at?.slice(0,10)}</td>
              <td>{r.item_name} <span className="item-code">({r.item_code})</span></td>
              <td>{formatNumber(r.quantity, 0)}</td>
              <td>{r.unit}</td>
              <td>{formatNumber(r.issued_cost, 2)}</td>
              <td>{formatNumber(r.quantity * r.issued_cost, 2)}</td>
              <td>{r.branch_name}</td>
              <td>{r.reference_no || '—'}</td>
              <td>{r.authorized_by || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title="Create Transfer" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Item *</label>
                <select className="form-input" value={form.itemId} onChange={handleItemChange} required>
                  <option value="">Select item…</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_code}) — Stock: {i.current_qty} {i.unit}</option>)}
                </select>
              </div>
              {selectedItem && (
                <div className="info-box" style={{ gridColumn: 'span 2' }}>
                  Available: <strong>{formatNumber(selectedItem.current_qty, 0)} {selectedItem.unit}</strong> &nbsp;|&nbsp;
                  WAC: <strong>Rs {formatNumber(selectedItem.weighted_avg_cost, 2)}</strong>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" min="0.01" step="any" max={selectedItem?.current_qty} value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Issued Cost (WAC)</label>
                <input className="form-input" type="text" value={selectedItem ? `Rs ${formatNumber(selectedItem.weighted_avg_cost, 2)}` : '—'} readOnly style={{ background: '#f5f5f5', color: '#666' }} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Destination Branch *</label>
                <select className="form-input" value={form.destinationBranchId} onChange={e => setForm(f => ({...f, destinationBranchId: e.target.value}))} required>
                  <option value="">Select branch…</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.location ? ` — ${b.location}` : ''}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Reference No.</label>
                <input className="form-input" value={form.referenceNo} onChange={e => setForm(f => ({...f, referenceNo: e.target.value}))} />
              </div>
            </div>
            {form.quantity && selectedItem && (
              <div className="info-box">
                Total transfer value: <strong>Rs {formatNumber(parseFloat(form.quantity || 0) * parseFloat(selectedItem.weighted_avg_cost || 0), 2)}</strong>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Create Transfer'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
