import { useState, useEffect, useCallback } from 'react'
import api from '../api.js'
import { useAuth } from '../store.jsx'
import { formatNumber } from '../utils.js'
import { SortTh, sortRows, makeOnSort } from '../components/SortTh.jsx'

const ADMIN_TABS = ['Current Stock', 'Branch Transfers', 'Low Stock Alerts', 'User Activity', 'Purchase History']
const USER_TABS = ['Current Stock']

export default function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const TABS = isAdmin ? ADMIN_TABS : USER_TABS

  const [tab, setTab] = useState(0)
  const [data, setData] = useState({})
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const onSort = makeOnSort(sortCol, setSortCol, sortDir, setSortDir)
  // Transfer sort
  const [tfSortCol, setTfSortCol] = useState('')
  const [tfSortDir, setTfSortDir] = useState('asc')
  const onTfSort = makeOnSort(tfSortCol, setTfSortCol, tfSortDir, setTfSortDir)
  // Purchase history sort
  const [phSortCol, setPhSortCol] = useState('')
  const [phSortDir, setPhSortDir] = useState('asc')
  const onPhSort = makeOnSort(phSortCol, setPhSortCol, phSortDir, setPhSortDir)

  // Items, branches, users for filter dropdowns
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [users, setUsers] = useState([])

  // Stock filters
  const [stockSearch, setStockSearch] = useState('')
  const [stockCat, setStockCat] = useState('')

  // Transfer filters
  const [tfBranch, setTfBranch] = useState('')
  const [tfItem, setTfItem] = useState('')
  const [tfFrom, setTfFrom] = useState('')
  const [tfTo, setTfTo] = useState('')

  // Activity filters
  const [actUser, setActUser] = useState('')
  const [actAction, setActAction] = useState('')
  const [actFrom, setActFrom] = useState('')
  const [actTo, setActTo] = useState('')

  // Purchase history filters
  const [phItem, setPhItem] = useState('')
  const [phVendor, setPhVendor] = useState('')
  const [phFrom, setPhFrom] = useState('')
  const [phTo, setPhTo] = useState('')

  useEffect(() => {
    api.get('/items').then(r => setItems(r.data)).catch(console.error)
    if (isAdmin) {
      api.get('/branches').then(r => setBranches(r.data)).catch(console.error)
      api.get('/users').then(r => setUsers(r.data)).catch(console.error)
    }
  }, [isAdmin])

  const loadStock = useCallback(() => {
    api.get('/reports/stock').then(r => setData(d => ({...d, stock: r.data}))).catch(console.error)
  }, [])

  const loadTransfers = useCallback(() => {
    let url = '/reports/transfers?'
    if (tfBranch) url += `branchId=${tfBranch}&`
    if (tfItem) url += `itemId=${tfItem}&`
    if (tfFrom) url += `from=${tfFrom}&`
    if (tfTo) url += `to=${tfTo}`
    api.get(url).then(r => setData(d => ({...d, transfers: r.data}))).catch(console.error)
  }, [tfBranch, tfItem, tfFrom, tfTo])

  const loadLowStock = useCallback(() => {
    api.get('/reports/low-stock').then(r => setData(d => ({...d, lowStock: r.data}))).catch(console.error)
  }, [])

  const loadActivity = useCallback(() => {
    let url = '/reports/activity?'
    if (actUser) url += `userId=${actUser}&`
    if (actAction) url += `action=${encodeURIComponent(actAction)}&`
    if (actFrom) url += `from=${actFrom}&`
    if (actTo) url += `to=${actTo}`
    api.get(url).then(r => setData(d => ({...d, activity: r.data}))).catch(console.error)
  }, [actUser, actAction, actFrom, actTo])

  const loadPurchaseHistory = useCallback(() => {
    let url = '/reports/inbound-history?'
    if (phItem) url += `itemId=${phItem}&`
    if (phVendor) url += `vendorName=${encodeURIComponent(phVendor)}&`
    if (phFrom) url += `from=${phFrom}&`
    if (phTo) url += `to=${phTo}`
    api.get(url).then(r => setData(d => ({...d, ph: r.data}))).catch(console.error)
  }, [phItem, phVendor, phFrom, phTo])

  useEffect(() => { loadStock() }, [loadStock])
  useEffect(() => { if (isAdmin && tab === 1) loadTransfers() }, [tab, loadTransfers, isAdmin])
  useEffect(() => { if (isAdmin && tab === 2) loadLowStock() }, [tab, loadLowStock, isAdmin])
  useEffect(() => { if (isAdmin && tab === 3) loadActivity() }, [tab, loadActivity, isAdmin])
  useEffect(() => { if (isAdmin && tab === 4) loadPurchaseHistory() }, [tab, loadPurchaseHistory, isAdmin])

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))]
  const actionTypes = ['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'INBOUND', 'OUTBOUND', 'EDIT_INBOUND', 'DELETE_INBOUND', 'CREATE_USER', 'UPDATE_USER', 'DEACTIVATE_USER']

  function exportCSV(filename, headers, rows) {
    const escape = v => {
      const s = v === null || v === undefined ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const filteredStock = sortRows(
    (data.stock || []).filter(i => {
      const q = stockSearch.toLowerCase()
      return (!q || i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q))
        && (!stockCat || i.category === stockCat)
    }),
    sortCol, sortDir
  )
  const sortedTransfers = sortRows(data.transfers || [], tfSortCol, tfSortDir)
  const sortedPH = sortRows(data.ph || [], phSortCol, phSortDir)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">{isAdmin ? 'Full reporting and audit logs' : 'Current stock overview'}</p>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={i} className={'tab-btn' + (tab === i ? ' active' : '')} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ── Current Stock ── */}
      {tab === 0 && (
        <>
          <div className="filter-bar" style={{ marginBottom: 14 }}>
            <input className="form-input" style={{ width: 250 }} placeholder="Search by name or code…" value={stockSearch} onChange={e => setStockSearch(e.target.value)} />
            <select className="form-input" style={{ width: 180 }} value={stockCat} onChange={e => setStockCat(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={loadStock}>↻ Refresh</button>
            <button className="btn btn-secondary" onClick={() => exportCSV(
              'current-stock.csv',
              ['Code', 'Name', 'Category', 'Unit', 'Qty', 'WAC (Rs)', 'Total Value (Rs)', 'Reorder Level'],
              filteredStock.map(i => [i.item_code, i.name, i.category || '', i.unit || '', i.current_qty, i.weighted_avg_cost, i.total_value || 0, i.reorder_level])
            )}>⬇ Export CSV</button>
          </div>
          <table className="table">
            <thead><tr>
              <SortTh col="item_code" label="Code" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTh col="name" label="Name" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTh col="category" label="Category" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTh col="unit" label="Unit" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTh col="current_qty" label="Qty" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTh col="weighted_avg_cost" label="WAC (Rs)" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTh col="total_value" label="Total Value (Rs)" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortTh col="reorder_level" label="Reorder Level" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            </tr></thead>
            <tbody>
              {!data.stock && <tr><td colSpan={8} className="empty-row">Loading…</td></tr>}
              {filteredStock.map(i => (
                <tr key={i.id} className={i.low_stock ? 'row-warning' : ''}>
                  <td><code>{i.item_code}</code></td>
                  <td>{i.name}{i.low_stock ? ' ⚠' : ''}</td>
                  <td>{i.category || '—'}</td>
                  <td>{i.unit || '—'}</td>
                  <td><strong>{formatNumber(i.current_qty, 0)}</strong></td>
                  <td>{formatNumber(i.weighted_avg_cost, 2)}</td>
                  <td>{formatNumber(i.total_value || 0, 2)}</td>
                  <td>{i.reorder_level}</td>
                </tr>
              ))}
              {data.stock && filteredStock.length === 0 && <tr><td colSpan={8} className="empty-row">No items match.</td></tr>}
            </tbody>
            {filteredStock.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6}><strong>Total</strong></td>
                  <td><strong>Rs {formatNumber(filteredStock.reduce((s, i) => s + (i.total_value || 0), 0), 2)}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </>
      )}

      {/* ── Branch Transfers ── */}
      {tab === 1 && isAdmin && (
        <>
          <div className="filter-bar filter-wrap" style={{ marginBottom: 14 }}>
            <select className="form-input" style={{ width: 190 }} value={tfBranch} onChange={e => setTfBranch(e.target.value)}>
              <option value="">All branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="form-input" style={{ width: 210 }} value={tfItem} onChange={e => setTfItem(e.target.value)}>
              <option value="">All items</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>)}
            </select>
            <input className="form-input" type="date" style={{ width: 150 }} value={tfFrom} onChange={e => setTfFrom(e.target.value)} title="From date" />
            <input className="form-input" type="date" style={{ width: 150 }} value={tfTo} onChange={e => setTfTo(e.target.value)} title="To date" />
            <button className="btn btn-secondary" onClick={loadTransfers}>↻ Apply</button>
            <button className="btn btn-secondary" onClick={() => { setTfBranch(''); setTfItem(''); setTfFrom(''); setTfTo('') }}>Clear</button>
            <button className="btn btn-secondary" onClick={() => exportCSV(
              'branch-transfers.csv',
              ['Date', 'Item', 'Item Code', 'Qty', 'Unit', 'WAC (Rs)', 'Total Value', 'Branch', 'Reference', 'Recorded By'],
              sortedTransfers.map(r => [r.created_at?.slice(0,10), r.item_name, r.item_code, r.quantity, r.unit, r.issued_cost, (r.quantity * r.issued_cost).toFixed(2), r.branch_name, r.reference_no || '', r.created_by_name || ''])
            )}>⬇ Export CSV</button>
          </div>
          <table className="table">
            <thead><tr>
              <SortTh col="created_at" label="Date" sortCol={tfSortCol} sortDir={tfSortDir} onSort={onTfSort} />
              <SortTh col="item_name" label="Item" sortCol={tfSortCol} sortDir={tfSortDir} onSort={onTfSort} />
              <SortTh col="quantity" label="Qty" sortCol={tfSortCol} sortDir={tfSortDir} onSort={onTfSort} />
              <SortTh col="unit" label="Unit" sortCol={tfSortCol} sortDir={tfSortDir} onSort={onTfSort} />
              <SortTh col="issued_cost" label="WAC (Rs)" sortCol={tfSortCol} sortDir={tfSortDir} onSort={onTfSort} />
              <th>Total Value</th>
              <SortTh col="branch_name" label="Branch" sortCol={tfSortCol} sortDir={tfSortDir} onSort={onTfSort} />
              <SortTh col="reference_no" label="Reference" sortCol={tfSortCol} sortDir={tfSortDir} onSort={onTfSort} />
              <SortTh col="created_by_name" label="By" sortCol={tfSortCol} sortDir={tfSortDir} onSort={onTfSort} />
            </tr></thead>
            <tbody>
              {!data.transfers && <tr><td colSpan={9} className="empty-row">Loading…</td></tr>}
              {sortedTransfers.map(r => (
                <tr key={r.id}>
                  <td>{r.created_at?.slice(0,10)}</td>
                  <td>{r.item_name} <span className="item-code">({r.item_code})</span></td>
                  <td>{formatNumber(r.quantity, 0)}</td>
                  <td>{r.unit}</td>
                  <td>{formatNumber(r.issued_cost, 2)}</td>
                  <td>{formatNumber(r.quantity * r.issued_cost, 2)}</td>
                  <td>{r.branch_name}</td>
                  <td>{r.reference_no || '—'}</td>
                  <td>{r.created_by_name || '—'}</td>
                </tr>
              ))}
              {sortedTransfers.length === 0 && data.transfers && <tr><td colSpan={9} className="empty-row">No transfers match.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {/* ── Low Stock ── */}
      {tab === 2 && isAdmin && (
        <>
          <div className="filter-bar" style={{ marginBottom: 14 }}>
            <select className="form-input" style={{ width: 200 }} value={stockCat} onChange={e => setStockCat(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={loadLowStock}>↻ Refresh</button>
            <button className="btn btn-secondary" onClick={() => {
              const rows = (data.lowStock || []).filter(i => !stockCat || i.category === stockCat)
              exportCSV('low-stock-alerts.csv',
                ['Code', 'Name', 'Category', 'Unit', 'Current Qty', 'Reorder Level', 'Vendor', 'Contact'],
                rows.map(i => [i.item_code, i.name, i.category || '', i.unit || '', i.current_qty, i.reorder_level, i.vendor_name || '', i.vendor_contact || ''])
              )
            }}>⬇ Export CSV</button>
          </div>
          <table className="table">
            <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th>Current Qty</th><th>Reorder Level</th><th>Vendor</th><th>Contact</th></tr></thead>
            <tbody>
              {!data.lowStock && <tr><td colSpan={8} className="empty-row">Loading…</td></tr>}
              {(data.lowStock || []).filter(i => !stockCat || i.category === stockCat).map(i => (
                <tr key={i.id} className="row-warning">
                  <td><code>{i.item_code}</code></td>
                  <td>⚠ {i.name}</td>
                  <td>{i.category || '—'}</td>
                  <td>{i.unit || '—'}</td>
                  <td><strong>{formatNumber(i.current_qty, 0)}</strong></td>
                  <td>{formatNumber(i.reorder_level, 0)}</td>
                  <td>{i.vendor_name || '—'}</td>
                  <td>{i.vendor_contact || '—'}</td>
                </tr>
              ))}
              {data.lowStock?.length === 0 && <tr><td colSpan={8} className="empty-row">No low-stock items. 🎉</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {/* ── User Activity ── */}
      {tab === 3 && isAdmin && (
        <>
          <div className="filter-bar filter-wrap" style={{ marginBottom: 14 }}>
            <select className="form-input" style={{ width: 180 }} value={actUser} onChange={e => setActUser(e.target.value)}>
              <option value="">All users</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <select className="form-input" style={{ width: 200 }} value={actAction} onChange={e => setActAction(e.target.value)}>
              <option value="">All actions</option>
              {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input className="form-input" type="date" style={{ width: 150 }} value={actFrom} onChange={e => setActFrom(e.target.value)} title="From date" />
            <input className="form-input" type="date" style={{ width: 150 }} value={actTo} onChange={e => setActTo(e.target.value)} title="To date" />
            <button className="btn btn-secondary" onClick={loadActivity}>↻ Apply</button>
            <button className="btn btn-secondary" onClick={() => { setActUser(''); setActAction(''); setActFrom(''); setActTo('') }}>Clear</button>
          </div>
          <table className="table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {!data.activity && <tr><td colSpan={5} className="empty-row">Loading…</td></tr>}
              {data.activity?.map(l => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.created_at?.replace('T', ' ').slice(0,19)}</td>
                  <td>{l.username || '—'}</td>
                  <td><code>{l.action}</code></td>
                  <td>{l.entity_type} {l.entity_id ? `#${l.entity_id}` : ''}</td>
                  <td style={{ maxWidth: 320, wordBreak: 'break-word' }}>{l.details || '—'}</td>
                </tr>
              ))}
              {data.activity?.length === 0 && <tr><td colSpan={5} className="empty-row">No activity records.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {/* ── Purchase History ── */}
      {tab === 4 && isAdmin && (
        <>
          <div className="filter-bar filter-wrap" style={{ marginBottom: 14 }}>
            <select className="form-input" style={{ width: 220 }} value={phItem} onChange={e => setPhItem(e.target.value)}>
              <option value="">All items</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>)}
            </select>
            <input className="form-input" style={{ width: 200 }} placeholder="Filter by vendor…" value={phVendor} onChange={e => setPhVendor(e.target.value)} />
            <input className="form-input" type="date" style={{ width: 150 }} value={phFrom} onChange={e => setPhFrom(e.target.value)} title="From date" />
            <input className="form-input" type="date" style={{ width: 150 }} value={phTo} onChange={e => setPhTo(e.target.value)} title="To date" />
            <button className="btn btn-secondary" onClick={loadPurchaseHistory}>↻ Apply</button>
            <button className="btn btn-secondary" onClick={() => { setPhItem(''); setPhVendor(''); setPhFrom(''); setPhTo('') }}>Clear</button>
            <button className="btn btn-secondary" onClick={() => exportCSV(
              'purchase-history.csv',
              ['Date', 'Item', 'Item Code', 'Qty', 'Unit', 'Unit Price (Rs)', 'Total (Rs)', 'Vendor', 'Invoice No.', 'Recorded By'],
              sortedPH.map(r => [r.invoice_date || r.created_at?.slice(0,10), r.item_name, r.item_code, r.quantity, r.unit, r.unit_price, (r.quantity * r.unit_price).toFixed(2), r.vendor_name || '', r.invoice_no || '', r.created_by_name || ''])
            )}>⬇ Export CSV</button>
          </div>
          <table className="table">
            <thead><tr>
              <SortTh col="invoice_date" label="Date" sortCol={phSortCol} sortDir={phSortDir} onSort={onPhSort} />
              <SortTh col="item_name" label="Item" sortCol={phSortCol} sortDir={phSortDir} onSort={onPhSort} />
              <SortTh col="quantity" label="Qty" sortCol={phSortCol} sortDir={phSortDir} onSort={onPhSort} />
              <SortTh col="unit" label="Unit" sortCol={phSortCol} sortDir={phSortDir} onSort={onPhSort} />
              <SortTh col="unit_price" label="Unit Price" sortCol={phSortCol} sortDir={phSortDir} onSort={onPhSort} />
              <th>Total</th>
              <SortTh col="vendor_name" label="Vendor" sortCol={phSortCol} sortDir={phSortDir} onSort={onPhSort} />
              <SortTh col="invoice_no" label="Invoice No." sortCol={phSortCol} sortDir={phSortDir} onSort={onPhSort} />
              <SortTh col="created_by_name" label="By" sortCol={phSortCol} sortDir={phSortDir} onSort={onPhSort} />
            </tr></thead>
            <tbody>
              {!data.ph && <tr><td colSpan={9} className="empty-row">Loading…</td></tr>}
              {sortedPH.map(r => (
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
                </tr>
              ))}
              {sortedPH.length === 0 && data.ph && <tr><td colSpan={9} className="empty-row">No records match.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
