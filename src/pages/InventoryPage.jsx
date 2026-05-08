import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../store.jsx'
import { formatNumber, formatCurrency } from '../utils.js'

const empty = { item_code: '', name: '', category: '', unit: '', reorder_level: '' }

export default function InventoryPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function fetchItems() { api.get('/items').then(r => setItems(r.data)).catch(console.error) }
  useEffect(() => {
    fetchItems()
    api.get('/vendors').then(r => setVendors(r.data)).catch(console.error)
    api.get('/categories').then(r => setCategories(r.data)).catch(console.error)
    api.get('/units').then(r => setUnits(r.data)).catch(console.error)
  }, [])

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
    const matchCat = !catFilter || i.category === catFilter
    return matchSearch && matchCat
  })

  function openAdd() { setForm(empty); setEditId(null); setError(''); setModal('add') }
  function openEdit(item) {
    setForm({
      item_code: item.item_code, name: item.name,
      category: item.category || '', unit: item.unit || '', reorder_level: item.reorder_level ?? ''
    })
    setEditId(item.id); setError(''); setModal('edit')
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (modal === 'add') await api.post('/items', form)
      else await api.put(`/items/${editId}`, form)
      setModal(null); fetchItems()
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving item')
    } finally { setLoading(false) }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try { await api.delete(`/items/${item.id}`); fetchItems() }
    catch (err) { alert(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">{isAdmin ? 'Manage all inventory items' : 'View current stock'}</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>}
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="form-input" style={{ width: 260 }} placeholder="Search by name or code…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-input" style={{ width: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Code</th><th>Name</th><th>Category</th><th>Unit</th>
            <th>Low Stock Alert Level</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="empty-row">No items found.</td></tr>}
          {filtered.map(item => (
            <tr key={item.id} className={item.current_qty <= item.reorder_level && item.reorder_level > 0 ? 'row-warning' : ''}>
              <td><code>{item.item_code}</code></td>
              <td>{item.name}</td>
              <td>{item.category || '—'}</td>
              <td>{item.unit || '—'}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {formatNumber(item.reorder_level, 0)}
                  {item.current_qty <= item.reorder_level && item.reorder_level > 0 && (
                    <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>LOW</span>
                  )}
                </div>
              </td>
              {isAdmin && (
                <td className="actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Item' : 'Edit Item'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Item Code *</label>
                <input className="form-input" value={form.item_code} onChange={e => setForm(f => ({...f, item_code: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-input" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} required>
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit *</label>
                <select className="form-input" value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))} required>
                  <option value="">Select unit…</option>
                  {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Low Stock Alert Level</label>
                <input className="form-input" type="number" min="0" value={form.reorder_level} onChange={e => setForm(f => ({...f, reorder_level: e.target.value}))} placeholder="Quantity at which to alert" />
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Set the minimum quantity before this item triggers a low stock alert</div>
              </div>
              {form.reorder_level && (
                <div className="info-box" style={{ gridColumn: 'span 2', marginTop: 0 }}>
                  ⚠ Low stock alert will trigger when quantity falls below <strong>{formatNumber(form.reorder_level, 0)} {form.unit || 'units'}</strong>
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
