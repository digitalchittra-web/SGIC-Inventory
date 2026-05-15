import { useState, useEffect } from 'react'
import api from '../api.js'
import { formatNumber } from '../utils.js'
import { useAuth } from '../store.jsx'

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    pending: { background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' },
    approved: { background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' },
  }
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, ...styles[status] }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
function AdminDashboard() {
  const [stock, setStock] = useState([])
  const [branches, setBranches] = useState([])
  const [pendingReqs, setPendingReqs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/reports/stock'),
      api.get('/branches'),
      api.get('/requisitions?status=pending'),
    ]).then(([s, b, r]) => {
      setStock(s.data)
      setBranches(b.data)
      setPendingReqs(r.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-loading">Loading…</div>

  const totalItems = stock.length
  const totalValue = stock.reduce((sum, i) => sum + (i.total_value || 0), 0)
  const lowStockCount = stock.filter(i => i.low_stock).length

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Sanima GIC Insurance — Inventory Overview</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#E6F1FB', color: '#185FA5' }}>📦</div>
          <div className="stat-value">{totalItems}</div>
          <div className="stat-label">Total Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#E1F5EE', color: '#0F6E56' }}>₨</div>
          <div className="stat-value">Rs {formatNumber(totalValue, 0)}</div>
          <div className="stat-label">Total Stock Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEF3C7', color: '#B45309' }}>⚠</div>
          <div className="stat-value">{lowStockCount}</div>
          <div className="stat-label">Low Stock Alerts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEF3C7', color: '#B45309' }}>📋</div>
          <div className="stat-value">{pendingReqs.length}</div>
          <div className="stat-label">Pending Requisitions</div>
        </div>
      </div>

      {pendingReqs.length > 0 && (
        <div className="section">
          <h2 className="section-title">📋 Pending Requisitions</h2>
          <table className="table">
            <thead><tr><th>#</th><th>Requested By</th><th>Items</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {pendingReqs.map(r => (
                <tr key={r.id}>
                  <td><strong>#{r.id}</strong></td>
                  <td>{r.requested_by}</td>
                  <td>{r.item_count} item{r.item_count !== 1 ? 's' : ''}</td>
                  <td>{r.created_at?.slice(0, 10)}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lowStockCount > 0 && (
        <div className="section">
          <h2 className="section-title">⚠ Low Stock Items</h2>
          <table className="table">
            <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th>Current Qty</th><th>Reorder Level</th></tr></thead>
            <tbody>
              {stock.filter(i => i.low_stock).map(item => (
                <tr key={item.id} className="row-warning">
                  <td>{item.item_code}</td><td>{item.name}</td><td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td><strong>{formatNumber(item.current_qty, 0)}</strong></td>
                  <td>{formatNumber(item.reorder_level, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── User Dashboard ────────────────────────────────────────────────────────────
function UserDashboard() {
  const [requisitions, setRequisitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState('')

  function fetchReqs() {
    setLoading(true)
    let url = '/requisitions?'
    if (filterMonth && filterYear) url += `month=${filterMonth}&year=${filterYear}`
    api.get(url).then(r => setRequisitions(r.data)).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { fetchReqs() }, [filterMonth, filterYear])

  const pending = requisitions.filter(r => r.status === 'pending')
  const approved = requisitions.filter(r => r.status === 'approved')

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Requisitions</h1>
          <p className="page-sub">Track your item requests and their approval status</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEF3C7', color: '#B45309' }}>⏳</div>
          <div className="stat-value">{pending.length}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#D1FAE5', color: '#065F46' }}>✓</div>
          <div className="stat-value">{approved.length}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#E6F1FB', color: '#185FA5' }}>📋</div>
          <div className="stat-value">{requisitions.length}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      {/* History filter */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <select className="form-input" style={{ width: 130 }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">All months</option>
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="form-input" style={{ width: 110 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={fetchReqs}>↻ Refresh</button>
      </div>

      {/* Pending section */}
      {pending.length > 0 && (
        <div className="section">
          <h2 className="section-title" style={{ color: '#B45309' }}>⏳ Pending Requests</h2>
          <table className="table">
            <thead><tr><th>#</th><th>Items</th><th>Date Submitted</th><th>Remarks</th><th>Status</th></tr></thead>
            <tbody>
              {pending.map(r => (
                <tr key={r.id} style={{ background: '#FFFBEB' }}>
                  <td><strong>#{r.id}</strong></td>
                  <td>{r.item_count} item{r.item_count !== 1 ? 's' : ''}</td>
                  <td>{r.created_at?.slice(0, 10)}</td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>{r.remarks || '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approved section */}
      {approved.length > 0 && (
        <div className="section">
          <h2 className="section-title" style={{ color: '#065F46' }}>✓ Approved Requests</h2>
          <table className="table">
            <thead><tr><th>#</th><th>Items</th><th>Date Submitted</th><th>Approved On</th><th>Reference</th><th>Status</th></tr></thead>
            <tbody>
              {approved.map(r => (
                <tr key={r.id} style={{ background: '#F0FDF4' }}>
                  <td><strong>#{r.id}</strong></td>
                  <td>{r.item_count} item{r.item_count !== 1 ? 's' : ''}</td>
                  <td>{r.created_at?.slice(0, 10)}</td>
                  <td>{r.approved_at?.slice(0, 10) || '—'}</td>
                  <td style={{ fontFamily: 'monospace', color: '#185FA5' }}>{r.reference_no || '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && requisitions.length === 0 && (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '48px 0', fontSize: 15 }}>
          No requisitions found. Use "New Requisition" to request items.
        </div>
      )}
      {loading && <div className="page-loading">Loading…</div>}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <AdminDashboard /> : <UserDashboard />
}
