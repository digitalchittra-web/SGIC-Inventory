import { useState, useEffect } from 'react'
import api from '../api.js'
import { formatNumber } from '../utils.js'

export default function Dashboard() {
  const [stock, setStock] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/reports/stock'), api.get('/branches')])
      .then(([s, b]) => { setStock(s.data); setBranches(b.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-loading">Loading…</div>

  const totalItems = stock.length
  const totalValue = stock.reduce((sum, i) => sum + (i.total_value || 0), 0)
  const lowStockCount = stock.filter(i => i.low_stock).length
  const totalBranches = branches.length

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
          <div className="stat-icon" style={{ background: '#EDE9FE', color: '#534AB7' }}>🏢</div>
          <div className="stat-value">{totalBranches}</div>
          <div className="stat-label">Branches</div>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="section">
          <h2 className="section-title">⚠ Low Stock Items</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Category</th><th>Unit</th>
                <th>Current Qty</th><th>Reorder Level</th>
              </tr>
            </thead>
            <tbody>
              {stock.filter(i => i.low_stock).map(item => (
                <tr key={item.id} className="row-warning">
                  <td>{item.item_code}</td>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td><strong>{formatNumber(item.current_qty, 0)}</strong></td>
                  <td>{formatNumber(item.reorder_level, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Branches</h2>
        <div className="branch-list">
          {branches.map(b => (
            <div key={b.id} className="branch-card">
              <div className="branch-icon">🏢</div>
              <div>
                <div className="branch-name">{b.name}</div>
                <div className="branch-loc">{b.location || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
