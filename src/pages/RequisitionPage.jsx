import { useState, useEffect } from 'react'
import api from '../api.js'
import Modal from '../components/Modal.jsx'
import ItemPicker from '../components/ItemPicker.jsx'
import { useAuth } from '../store.jsx'

// ── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    pending: { background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' },
    approved: { background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' },
    rejected: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
  }
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      ...styles[status]
    }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ── Empty row for new requisition form ──────────────────────────────────────
const emptyItemRow = () => ({ itemId: '', quantity: '', description: '' })

export default function RequisitionPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [requisitions, setRequisitions] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [formRows, setFormRows] = useState([emptyItemRow()])
  const [remarks, setRemarks] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Detail/edit modal state
  const [selected, setSelected] = useState(null) // {req, items}
  const [detailLoading, setDetailLoading] = useState(false)
  const [editAdminQtys, setEditAdminQtys] = useState({}) // itemId → qty
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState('')

  // User edit modal
  const [editModal, setEditModal] = useState(null) // requisition to edit
  const [editRows, setEditRows] = useState([])
  const [editRemarks, setEditRemarks] = useState('')
  const [editError, setEditError] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')

  function fetchRequisitions() {
    setLoading(true)
    const url = statusFilter ? `/requisitions?status=${statusFilter}` : '/requisitions'
    api.get(url).then(r => setRequisitions(r.data)).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRequisitions()
    api.get('/items').then(r => setItems(r.data)).catch(console.error)
  }, [statusFilter])

  // ── Create form ────────────────────────────────────────────────────────────
  function updateFormRow(i, field, value) {
    setFormRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }
  function addFormRow() { setFormRows(prev => [...prev, emptyItemRow()]) }
  function removeFormRow(i) { if (formRows.length > 1) setFormRows(prev => prev.filter((_, idx) => idx !== i)) }

  function handleOpenCreate() {
    setFormRows([emptyItemRow()])
    setRemarks('')
    setFormError('')
    setShowConfirm(false)
    setShowCreate(true)
  }

  function handleReviewClick() {
    const validRows = formRows.filter(r => r.itemId)
    const emptyRows = formRows.filter(r => !r.itemId)

    if (emptyRows.length > 0) { setFormError('All rows must have an item selected.'); return }
    if (!validRows.every(r => r.quantity >= 1)) { setFormError('All quantities must be ≥ 1.'); return }

    // Check no duplicate items
    const ids = validRows.map(r => r.itemId)
    if (new Set(ids).size !== ids.length) { setFormError('Duplicate items are not allowed. Please remove duplicates.'); return }

    setFormError('')
    setShowConfirm(true)
  }

  async function handleSubmitCreate() {
    setSubmitting(true)
    try {
      await api.post('/requisitions', {
        items: formRows.map(r => ({ itemId: r.itemId, quantity: parseInt(r.quantity), description: r.description })),
        remarks,
      })
      setShowCreate(false)
      setShowConfirm(false)
      fetchRequisitions()
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.message
        || (err.response ? `Server error ${err.response.status}` : `Network error: ${err.message}`)
      setFormError(msg)
      setShowConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Open detail ────────────────────────────────────────────────────────────
  async function openDetail(req) {
    setDetailLoading(true)
    setSelected(null)
    setApproveError('')
    try {
      const res = await api.get(`/requisitions/${req.id}`)
      setSelected(res.data)
      // Pre-fill admin qty with approved_quantity if set, else original quantity
      const qtys = {}
      res.data.items.forEach(i => {
        qtys[i.id] = i.approved_quantity !== null && i.approved_quantity !== undefined
          ? i.approved_quantity : i.quantity
      })
      setEditAdminQtys(qtys)
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() { setSelected(null); setApproveError('') }

  // Admin saves edited quantities before approving
  async function handleSaveAdminQtys() {
    try {
      const itemUpdates = selected.items.map(i => ({ id: i.id, approved_quantity: editAdminQtys[i.id] ?? i.quantity }))
      await api.put(`/requisitions/${selected.id}`, { items: itemUpdates })
    } catch (err) {
      setApproveError(err.response?.data?.error || 'Failed to save quantities')
      throw err
    }
  }

  async function handleApprove() {
    setApproving(true)
    setApproveError('')
    try {
      await handleSaveAdminQtys()
      const res = await api.post(`/requisitions/${selected.id}/approve`)
      closeDetail()
      fetchRequisitions()
      if (res.data.warnings?.length) alert('Approved with warnings:\n' + res.data.warnings.join('\n'))
    } catch (err) {
      setApproveError(err.response?.data?.error || 'Approval failed')
    } finally {
      setApproving(false)
    }
  }

  // ── User edit ──────────────────────────────────────────────────────────────
  function openUserEdit(req) {
    setEditModal(req)
    setEditRows(req.items
      ? req.items.map(i => ({ itemId: String(i.item_id), quantity: i.quantity, description: i.description || '' }))
      : [emptyItemRow()])
    setEditRemarks(req.remarks || '')
    setEditError('')
  }

  async function handleLoadAndEdit(req) {
    try {
      const res = await api.get(`/requisitions/${req.id}`)
      openUserEdit(res.data)
    } catch (err) { console.error(err) }
  }

  async function handleSubmitEdit() {
    const valid = editRows.every(r => r.itemId && r.quantity >= 1)
    if (!valid) { setEditError('Every row must have an item and quantity ≥ 1.'); return }
    const ids = editRows.map(r => r.itemId)
    if (new Set(ids).size !== ids.length) { setEditError('Duplicate items not allowed.'); return }

    setEditSubmitting(true)
    try {
      await api.put(`/requisitions/${editModal.id}`, {
        items: editRows.map(r => ({ itemId: r.itemId, quantity: parseInt(r.quantity), description: r.description })),
        remarks: editRemarks,
      })
      setEditModal(null)
      fetchRequisitions()
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update')
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleDelete(req) {
    if (!confirm('Delete this requisition?')) return
    try {
      await api.delete(`/requisitions/${req.id}`)
      fetchRequisitions()
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'Requisition Requests' : 'My Requisitions'}</h1>
          <p className="page-sub">
            {isAdmin ? 'Review and approve staff requisition requests' : 'Request items from inventory'}
          </p>
        </div>
        {!isAdmin && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>+ New Requisition</button>
        )}
      </div>

      {/* Filter */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <select className="form-input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>
        <button className="btn btn-secondary" onClick={fetchRequisitions}>↻ Refresh</button>
      </div>

      {/* List */}
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            {isAdmin && <th>Requested By</th>}
            <th>Items</th>
            <th>Date</th>
            <th>Status</th>
            <th>Reference</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={isAdmin ? 7 : 6} className="empty-row">Loading…</td></tr>}
          {!loading && requisitions.length === 0 && (
            <tr><td colSpan={isAdmin ? 7 : 6} className="empty-row">No requisitions found.</td></tr>
          )}
          {requisitions.map(req => (
            <tr
              key={req.id}
              style={req.status === 'approved' ? { background: '#F0FDF4' } : {}}
            >
              <td><strong>#{req.id}</strong></td>
              {isAdmin && <td>{req.requested_by}</td>}
              <td>{req.item_count} item{req.item_count !== 1 ? 's' : ''}</td>
              <td>{req.created_at?.slice(0, 10)}</td>
              <td><StatusBadge status={req.status} /></td>
              <td style={{ fontFamily: 'monospace' }}>{req.reference_no || '—'}</td>
              <td className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openDetail(req)}>
                  {isAdmin && req.status === 'pending' ? 'Review' : 'View'}
                </button>
                {!isAdmin && req.status === 'pending' && (
                  <>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleLoadAndEdit(req)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(req)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Create Modal ── */}
      {showCreate && (
        <Modal title="New Requisition" onClose={() => setShowCreate(false)}>
          {!showConfirm ? (
            <>
              {formError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{formError}</div>}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={thStyle}>Item *</th>
                      <th style={thStyle}>Qty *</th>
                      <th style={thStyle}>Description</th>
                      <th style={{ ...thStyle, width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formRows.map((row, i) => {
                      const selectedIds = formRows.map(r => r.itemId).filter(Boolean)
                      const availableItems = items.filter(it => !selectedIds.includes(String(it.id)) || String(it.id) === row.itemId)
                      return (
                      <tr key={i}>
                        <td style={tdStyle}>
                          <ItemPicker
                            items={availableItems}
                            value={row.itemId}
                            onChange={v => updateFormRow(i, 'itemId', v)}
                            placeholder="Search item…"
                            hideQuantity={!isAdmin}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            className="form-input"
                            type="number" min="1" step="1"
                            style={{ width: 80 }}
                            value={row.quantity}
                            onChange={e => updateFormRow(i, 'quantity', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td style={tdStyle}>
                          <textarea
                            className="form-input"
                            rows={2}
                            style={{ width: '100%', resize: 'none' }}
                            value={row.description}
                            onChange={e => updateFormRow(i, 'description', e.target.value)}
                            placeholder="Purpose / notes…"
                          />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button type="button" onClick={() => removeFormRow(i)}
                            disabled={formRows.length <= 1}
                            style={{ background: 'none', border: 'none', cursor: formRows.length <= 1 ? 'not-allowed' : 'pointer', color: formRows.length <= 1 ? '#D1D5DB' : '#EF4444', fontSize: 16 }}>
                            &#x2715;
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={addFormRow}>
                + Add Item
              </button>
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Remarks</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Any additional notes for this request…"
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleReviewClick}>Review & Confirm →</button>
              </div>
            </>
          ) : (
            /* Confirm view */
            <>
              <p style={{ marginBottom: 12, color: '#374151', fontWeight: 500 }}>
                Please confirm the following requisition before submitting:
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {formRows.filter(r => r.itemId).map((row, i) => {
                    const it = items.find(x => String(x.id) === row.itemId)
                    return (
                      <tr key={i}>
                        <td style={tdStyle}><strong>{it?.name}</strong></td>
                        <td style={tdStyle}>{row.quantity} {it?.unit || ''}</td>
                        <td style={tdStyle}>{row.description || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {remarks && (
                <div style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
                  <strong>Remarks:</strong> {remarks}
                </div>
              )}
              {formError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{formError}</div>}
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>← Back to Edit</button>
                <button className="btn btn-primary" onClick={handleSubmitCreate} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Requisition'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── Detail / Admin Review Modal ── */}
      {(selected || detailLoading) && (
        <Modal
          title={isAdmin ? `Requisition #${selected?.id} — ${selected?.requested_by}` : `Requisition #${selected?.id}`}
          onClose={closeDetail}
        >
          {detailLoading && <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Loading…</div>}
          {selected && (
            <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <StatusBadge status={selected.status} />
                <span style={{ fontSize: 13, color: '#6b7280' }}>Submitted: {selected.created_at?.slice(0, 10)}</span>
                {selected.approved_at && <span style={{ fontSize: 13, color: '#6b7280' }}>Approved: {selected.approved_at?.slice(0, 10)} by {selected.approved_by_name}</span>}
                {selected.reference_no && <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#185FA5' }}>{selected.reference_no}</span>}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Requested Qty</th>
                    {isAdmin && selected.status === 'pending' && <th style={thStyle}>Approve Qty</th>}
                    {isAdmin && selected.status === 'approved' && <th style={thStyle}>Approved Qty</th>}
                    <th style={thStyle}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map(item => (
                    <tr key={item.id}>
                      <td style={tdStyle}>
                        <strong>{item.item_name}</strong>{' '}
                        <span style={{ color: '#9ca3af', fontSize: 11 }}>({item.item_code})</span>
                      </td>
                      <td style={tdStyle}>{item.quantity} {item.unit || ''}</td>
                      {isAdmin && selected.status === 'pending' && (
                        <td style={tdStyle}>
                          <input
                            className="form-input"
                            type="number" min="0" step="1"
                            style={{ width: 80 }}
                            value={editAdminQtys[item.id] ?? item.quantity}
                            onChange={e => setEditAdminQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>{item.unit || ''}</span>
                        </td>
                      )}
                      {isAdmin && selected.status === 'approved' && (
                        <td style={tdStyle}>{item.approved_quantity ?? item.quantity} {item.unit || ''}</td>
                      )}
                      <td style={tdStyle}>{item.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selected.remarks && (
                <div style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 14 }}>
                  <strong>Remarks:</strong> {selected.remarks}
                </div>
              )}

              {approveError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{approveError}</div>}

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={closeDetail}>Close</button>
                {isAdmin && selected.status === 'pending' && (
                  <button className="btn btn-primary" onClick={handleApprove} disabled={approving}>
                    {approving ? 'Approving…' : '✓ Approve & Issue'}
                  </button>
                )}
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── User Edit Modal ── */}
      {editModal && (
        <Modal title={`Edit Requisition #${editModal.id}`} onClose={() => setEditModal(null)}>
          {editError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{editError}</div>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={thStyle}>Item *</th>
                  <th style={thStyle}>Qty *</th>
                  <th style={thStyle}>Description</th>
                  <th style={{ ...thStyle, width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {editRows.map((row, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>
                      <select className="form-input" style={{ width: 200 }} value={row.itemId}
                        onChange={e => setEditRows(prev => prev.map((r, idx) => idx === i ? { ...r, itemId: e.target.value } : r))}>
                        <option value="">— select item —</option>
                        {items.map(it => <option key={it.id} value={String(it.id)}>{it.item_code} — {it.name}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input className="form-input" type="number" min="1" step="1" style={{ width: 80 }}
                        value={row.quantity}
                        onChange={e => setEditRows(prev => prev.map((r, idx) => idx === i ? { ...r, quantity: e.target.value } : r))}
                        placeholder="0" />
                    </td>
                    <td style={tdStyle}>
                      <input className="form-input" style={{ width: 180 }} value={row.description}
                        onChange={e => setEditRows(prev => prev.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))}
                        placeholder="Purpose / note" />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button type="button" onClick={() => setEditRows(prev => prev.filter((_, idx) => idx !== i))}
                        disabled={editRows.length <= 1}
                        style={{ background: 'none', border: 'none', cursor: editRows.length <= 1 ? 'not-allowed' : 'pointer', color: editRows.length <= 1 ? '#D1D5DB' : '#EF4444', fontSize: 16 }}>
                        &#x2715;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}
            onClick={() => setEditRows(prev => [...prev, emptyItemRow()])}>
            + Add Item
          </button>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Remarks</label>
            <textarea className="form-input" rows={3} value={editRemarks} onChange={e => setEditRemarks(e.target.value)}
              style={{ resize: 'vertical' }} placeholder="Any additional notes…" />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmitEdit} disabled={editSubmitting}>
              {editSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const thStyle = {
  padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 12,
  color: '#374151', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
}
const tdStyle = {
  padding: '7px 10px', verticalAlign: 'middle', borderBottom: '1px solid #F3F4F6',
}
