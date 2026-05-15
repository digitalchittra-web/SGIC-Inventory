import { useState } from 'react'
import api from '../api.js'
import { useFiscalYear } from '../context/FiscalYearContext.jsx'
import Modal from '../components/Modal.jsx'

export default function SettingsPage() {
  const { fiscalYears, activeFiscalYear, viewingFiscalYear, setViewingFiscalYear, refetch } = useFiscalYear()
  const [showNewFYModal, setShowNewFYModal] = useState(false)
  const [newFYName, setNewFYName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleCreateFiscalYear(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!newFYName.trim()) { setError('Please enter a fiscal year name'); return }
    setLoading(true)
    try {
      await api.post('/fiscal-years', { name: newFYName.trim() })
      setSuccess(`Fiscal year "${newFYName.trim()}" created and set as active.`)
      setNewFYName('')
      setShowNewFYModal(false)
      refetch()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create fiscal year')
    } finally {
      setLoading(false)
    }
  }

  async function handleReactivate(y) {
    if (!confirm(`Reactivate fiscal year "${y.name}"?\n\nThis will archive the current active year and make "${y.name}" active again.`)) return
    try {
      const res = await api.put(`/fiscal-years/${y.id}/activate`)
      setSuccess(res.data.message)
      if (viewingFiscalYear?.id === y.id) setViewingFiscalYear(y)
      refetch()
    } catch (err) {
      setSuccess('')
      alert(err.response?.data?.error || 'Failed to reactivate fiscal year')
    }
  }

  async function handleDelete(y) {
    if (!confirm(`Delete fiscal year "${y.name}"?\n\nAll inbound and outbound records linked to this year will be unlinked (but not deleted). This cannot be undone.`)) return
    try {
      const res = await api.delete(`/fiscal-years/${y.id}`)
      setSuccess(res.data.message)
      if (viewingFiscalYear?.id === y.id) setViewingFiscalYear(activeFiscalYear)
      refetch()
    } catch (err) {
      setSuccess('')
      alert(err.response?.data?.error || 'Failed to delete fiscal year')
    }
  }

  const previousYears = fiscalYears.filter(y => !y.is_active)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Manage fiscal years and system settings.</p>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Current Fiscal Year */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Current Fiscal Year</h2>
        {activeFiscalYear ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <span className="badge badge-admin" style={{ fontSize: 16, padding: '6px 14px' }}>
                {activeFiscalYear.name}
              </span>
              <span style={{ marginLeft: 12, color: '#6b7280', fontSize: 13 }}>Active fiscal year</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {fiscalYears.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 13, color: '#6b7280' }}>View Year:</label>
                  <select
                    value={viewingFiscalYear?.id || activeFiscalYear.id}
                    onChange={e => {
                      const fy = fiscalYears.find(y => String(y.id) === e.target.value)
                      if (fy) setViewingFiscalYear(fy)
                    }}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      fontSize: 13,
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {fiscalYears.map(y => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.is_active ? '(Active)' : '(Archived)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button className="btn btn-primary" onClick={() => { setNewFYName(''); setError(''); setShowNewFYModal(true) }}>
                + Start New Fiscal Year
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: '#6b7280' }}>No active fiscal year found.
            <button className="btn btn-primary" style={{ marginLeft: 12 }} onClick={() => setShowNewFYModal(true)}>
              + Create Fiscal Year
            </button>
          </div>
        )}
      </div>

      {/* Previous Fiscal Years */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Previous Fiscal Years</h2>
        {previousYears.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>No previous fiscal years found.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fiscal Year</th>
                <th>Created</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {previousYears.map(y => (
                <tr key={y.id}>
                  <td><strong>{y.name}</strong></td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>{y.created_at?.slice(0, 10)}</td>
                  <td><span className="badge badge-staff">Archived</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {viewingFiscalYear?.id === y.id ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setViewingFiscalYear(activeFiscalYear)}
                        >
                          Back to Active
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setViewingFiscalYear(y)}
                        >
                          View Data
                        </button>
                      )}
                      <button
                        className="btn btn-sm"
                        style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}
                        onClick={() => handleReactivate(y)}
                        title="Make this year active again (undo)"
                      >
                        ↩ Reactivate
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(y)}
                        title="Delete this fiscal year"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNewFYModal && (
        <Modal title="Start New Fiscal Year" onClose={() => setShowNewFYModal(false)}>
          <form onSubmit={handleCreateFiscalYear}>
            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
              Starting a new fiscal year will archive the current year's data. All inbound and outbound records will be stored under <strong>{activeFiscalYear?.name || 'current year'}</strong>. New transactions will be recorded under the new fiscal year.
            </p>
            <div className="form-group">
              <label className="form-label">New Fiscal Year Name *</label>
              <input
                className="form-input"
                placeholder="e.g. 82/83"
                value={newFYName}
                onChange={e => setNewFYName(e.target.value)}
                autoFocus
              />
              <small style={{ color: '#9ca3af' }}>Use Nepal BS year format, e.g. 82/83 for 2082/83</small>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewFYModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating…' : 'Create & Activate'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
