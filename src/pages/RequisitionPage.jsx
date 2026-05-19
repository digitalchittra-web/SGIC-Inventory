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
  const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Invalid Slip' }
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      ...(styles[status] || styles.rejected)
    }}>
      {labels[status] || status}
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

  // Item summary modal
  const [showSummary, setShowSummary] = useState(false)
  const [summaryData, setSummaryData] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  async function openSummary() {
    setShowSummary(true)
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const res = await api.get('/requisitions/item-summary')
      setSummaryData(res.data)
    } catch (err) {
      setSummaryError(err.response?.data?.error || `API error: ${err.message}`)
    } finally {
      setSummaryLoading(false)
    }
  }

  // Transfer / Purchase panel (admin) — inline, not modal
  const [activePanel, setActivePanel] = useState(isAdmin ? 'transfer' : null) // null | 'transfer' | 'purchase'

  function openTransferModal() {
    setActivePanel(prev => prev === 'transfer' ? null : 'transfer')
    fetchRequisitions()
  }

  // Purchase requests panel (admin)
  const [purchaseRequests, setPurchaseRequests] = useState([])
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [selectedPR, setSelectedPR] = useState(null)
  const [prActionLoading, setPrActionLoading] = useState(false)
  const [prError, setPrError] = useState('')

  async function openPurchaseModal() {
    const next = activePanel === 'purchase' ? null : 'purchase'
    setActivePanel(next)
    if (next === 'purchase') {
      setPurchaseLoading(true)
      setSelectedPR(null)
      try {
        const res = await api.get('/purchase-requests')
        setPurchaseRequests(res.data)
      } catch (err) { console.error(err) }
      finally { setPurchaseLoading(false) }
    }
  }

  async function openPRDetail(pr) {
    try {
      const res = await api.get(`/purchase-requests/${pr.id}`)
      setSelectedPR(res.data)
      setPrError('')
    } catch (err) { console.error(err) }
  }

  async function handlePRApprove() {
    setPrActionLoading(true); setPrError('')
    try {
      await api.post(`/purchase-requests/${selectedPR.id}/approve`)
      setSelectedPR(null)
      const res = await api.get('/purchase-requests')
      setPurchaseRequests(res.data)
    } catch (err) { setPrError(err.response?.data?.error || 'Failed') }
    finally { setPrActionLoading(false) }
  }

  async function handlePRReject() {
    if (!confirm('Reject this purchase request?')) return
    setPrActionLoading(true); setPrError('')
    try {
      await api.post(`/purchase-requests/${selectedPR.id}/reject`)
      setSelectedPR(null)
      const res = await api.get('/purchase-requests')
      setPurchaseRequests(res.data)
    } catch (err) { setPrError(err.response?.data?.error || 'Failed') }
    finally { setPrActionLoading(false) }
  }

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
      await api.post(`/requisitions/${selected.id}/approve`)
      closeDetail()
      fetchRequisitions()
    } catch (err) {
      setApproveError(err.response?.data?.error || 'Approval failed')
    } finally {
      setApproving(false)
    }
  }

  async function handleReject() {
    if (!confirm('Reject this requisition? No outbound entry will be created. The user will see it as an Invalid Slip.')) return
    setApproving(true)
    setApproveError('')
    try {
      await api.post(`/requisitions/${selected.id}/reject`)
      closeDetail()
      fetchRequisitions()
    } catch (err) {
      setApproveError(err.response?.data?.error || 'Failed to reject')
    } finally {
      setApproving(false)
    }
  }

  async function handleInvalidate() {
    if (!confirm('Mark as Invalid Slip? This will REVERSE the outbound entries and restore inventory quantities.')) return
    setApproving(true)
    setApproveError('')
    try {
      await api.post(`/requisitions/${selected.id}/invalidate`)
      closeDetail()
      fetchRequisitions()
    } catch (err) {
      setApproveError(err.response?.data?.error || 'Failed to invalidate')
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
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button className="btn btn-secondary" onClick={openSummary}>Total Items</button>
          )}
          {!isAdmin && (
            <button className="btn btn-primary" onClick={handleOpenCreate}>+ New Requisition</button>
          )}
        </div>
      </div>

      {/* Staff: filter + list */}
      {!isAdmin && (
        <>
          <div className="filter-bar" style={{ marginBottom: 16 }}>
            <select className="form-input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
            <button className="btn btn-secondary" onClick={fetchRequisitions}>↻ Refresh</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Items</th>
                <th>Date</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="empty-row">Loading…</td></tr>}
              {!loading && requisitions.length === 0 && (
                <tr><td colSpan={6} className="empty-row">No requisitions found.</td></tr>
              )}
              {requisitions.map(req => (
                <tr key={req.id}
                  style={req.status === 'approved' ? { background: '#F0FDF4' } : req.status === 'rejected' ? { background: '#FFF5F5' } : {}}
                >
                  <td><strong>#{req.id}</strong></td>
                  <td>{req.item_count} item{req.item_count !== 1 ? 's' : ''}</td>
                  <td>{req.created_at?.slice(0, 10)}</td>
                  <td><StatusBadge status={req.status} /></td>
                  <td style={{ fontFamily: 'monospace' }}>{req.reference_no || '—'}</td>
                  <td className="actions">
                    <button className="btn btn-sm btn-secondary" onClick={() => openDetail(req)}>View</button>
                    {req.status === 'pending' && (
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
        </>
      )}

      {/* ── Admin inline panels ── */}
      {isAdmin && activePanel === 'transfer' && (
        <div style={{ marginBottom: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Transfer Requests</h3>
            <select className="form-input" style={{ width: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
            <button className="btn btn-secondary" onClick={fetchRequisitions}>↻</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Requested By</th><th>Items</th><th>Date</th><th>Status</th><th>Reference</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="empty-row">Loading…</td></tr>}
              {!loading && requisitions.length === 0 && <tr><td colSpan={7} className="empty-row">No transfer requests found.</td></tr>}
              {requisitions.map(req => (
                <tr key={req.id} style={req.status === 'approved' ? { background: '#F0FDF4' } : req.status === 'rejected' ? { background: '#FFF5F5' } : {}}>
                  <td><strong>#{req.id}</strong></td>
                  <td>{req.requested_by}</td>
                  <td>{req.item_count} item{req.item_count !== 1 ? 's' : ''}</td>
                  <td>{req.created_at?.slice(0, 10)}</td>
                  <td><StatusBadge status={req.status} /></td>
                  <td style={{ fontFamily: 'monospace' }}>{req.reference_no || '—'}</td>
                  <td className="actions">
                    <button className="btn btn-sm btn-secondary" onClick={() => openDetail(req)}>{req.status === 'pending' ? 'Review' : 'View'}</button>
                    {(req.status === 'pending' || req.status === 'rejected') && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(req)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && activePanel === 'purchase' && (
        <div style={{ marginBottom: 80 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>Purchase Requests</h3>
          {selectedPR ? (
            <>
              <button className="btn btn-secondary btn-sm" style={{ marginBottom: 10 }} onClick={() => setSelectedPR(null)}>← Back to list</button>
              <div style={{ marginBottom: 10, fontSize: 13, color: '#6b7280' }}>
                Submitted by <strong>{selectedPR.requested_by}</strong> on {selectedPR.created_at?.slice(0,10)}
                {' '}<StatusBadge status={selectedPR.status} />
              </div>
              <table className="table">
                <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Vendor</th><th>Invoice</th></tr></thead>
                <tbody>
                  {selectedPR.items?.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.item_name}</strong> <span style={{ color: '#9ca3af', fontSize: 11 }}>({item.item_code})</span></td>
                      <td>{item.quantity} {item.unit || ''}</td>
                      <td>Rs {parseFloat(item.unit_price).toLocaleString()}</td>
                      <td>{item.vendor_name || '—'}</td>
                      <td>{item.invoice_no || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedPR.remarks && <div style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '10px 0' }}><strong>Remarks:</strong> {selectedPR.remarks}</div>}
              {prError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{prError}</div>}
              {selectedPR.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-danger" onClick={handlePRReject} disabled={prActionLoading}>{prActionLoading ? 'Processing…' : '✕ Reject'}</button>
                  <button className="btn btn-primary" onClick={handlePRApprove} disabled={prActionLoading}>{prActionLoading ? 'Approving…' : '✓ Approve & Record'}</button>
                </div>
              )}
            </>
          ) : purchaseLoading ? (
            <div style={{ color: '#6b7280', padding: 16 }}>Loading…</div>
          ) : (
            <table className="table">
              <thead><tr><th>#</th><th>Requested By</th><th>Items</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {purchaseRequests.length === 0 && <tr><td colSpan={6} className="empty-row">No purchase requests found.</td></tr>}
                {purchaseRequests.map(pr => (
                  <tr key={pr.id} style={{ background: pr.status === 'approved' ? '#F0FDF4' : pr.status === 'rejected' ? '#FFF5F5' : '' }}>
                    <td><strong>#{pr.id}</strong></td>
                    <td>{pr.requested_by}</td>
                    <td>{pr.item_count} item{pr.item_count !== 1 ? 's' : ''}</td>
                    <td>{pr.created_at?.slice(0,10)}</td>
                    <td><StatusBadge status={pr.status} /></td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => openPRDetail(pr)}>{pr.status === 'pending' ? 'Review' : 'View'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Admin fixed bottom bar ── */}
      {isAdmin && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E5E7EB', padding: '10px 24px', display: 'flex', gap: 10, zIndex: 100 }}>
          <button
            className={activePanel === 'transfer' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={openTransferModal}
          >
            Transfer Requests
          </button>
          <button
            className={activePanel === 'purchase' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={openPurchaseModal}
          >
            Purchase Requests
          </button>
        </div>
      )}

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

              {/* Invalid slip notice for users */}
              {!isAdmin && selected.status === 'rejected' && (
                <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: '#991B1B', fontSize: 14, marginBottom: 4 }}>⚠ Invalid Slip</div>
                  <div style={{ color: '#7F1D1D', fontSize: 13 }}>This requisition has been invalidated by the admin. Please create a new requisition.</div>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Requested Qty</th>
                    <th style={thStyle}>Available Qty</th>
                    {isAdmin && selected.status === 'pending' && <th style={thStyle}>Approve Qty</th>}
                    {selected.status === 'approved' && <th style={thStyle}>Approved Qty</th>}
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
                      <td style={tdStyle}>
                        <span style={{
                          fontWeight: 600,
                          color: item.current_qty <= 0 ? '#DC2626' : item.current_qty < item.quantity ? '#D97706' : '#065F46'
                        }}>
                          {item.current_qty ?? '—'}
                        </span>
                        {item.unit ? <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 3 }}>{item.unit}</span> : null}
                      </td>
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
                      {selected.status === 'approved' && (
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
                {!isAdmin && selected.status === 'rejected' && (
                  <button className="btn btn-primary" onClick={() => { closeDetail(); handleOpenCreate() }}>
                    + Create New Requisition
                  </button>
                )}
                {isAdmin && selected.status === 'pending' && (
                  <>
                    <button className="btn btn-danger" onClick={handleReject} disabled={approving}>
                      {approving ? 'Processing…' : '✕ Reject'}
                    </button>
                    <button className="btn btn-primary" onClick={handleApprove} disabled={approving}>
                      {approving ? 'Approving…' : '✓ Approve & Issue'}
                    </button>
                  </>
                )}
                {isAdmin && selected.status === 'approved' && (
                  <button className="btn btn-danger" onClick={handleInvalidate} disabled={approving}>
                    {approving ? 'Processing…' : '✕ Mark as Invalid Slip'}
                  </button>
                )}
              </div>
            </>
          )}
        </Modal>
      )}


      {/* ── Item Summary Modal ── */}
      {showSummary && (
        <Modal title="Total Items — Pending Requests" onClose={() => setShowSummary(false)}>
          {summaryLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Loading…</div>
          ) : summaryError ? (
            <div className="alert alert-error">{summaryError}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={thStyle}>Item</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total Requested</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Available</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.length === 0 && (
                    <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>No data found.</td></tr>
                  )}
                  {summaryData.map((row, i) => {
                    const diff = (row.available_qty ?? 0) - row.total_requested
                    return (
                      <tr key={i} style={{ background: diff < 0 ? '#FFF5F5' : 'transparent' }}>
                        <td style={tdStyle}>
                          <strong>{row.item_name}</strong>{' '}
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>({row.item_code})</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{row.total_requested} {row.unit || ''}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: row.available_qty <= 0 ? '#DC2626' : '#065F46' }}>
                          {row.available_qty ?? 0} {row.unit || ''}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: diff < 0 ? '#DC2626' : '#065F46' }}>
                          {diff >= 0 ? '+' : ''}{diff} {row.unit || ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setShowSummary(false)}>Close</button>
          </div>
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
