import { useState, useEffect } from 'react'
import api from '../api.js'
import { SortTh, sortRows, makeOnSort } from '../components/SortTh.jsx'

export default function UserInventoryPage() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const onSort = makeOnSort(sortCol, setSortCol, sortDir, setSortDir)

  useEffect(() => {
    Promise.all([
      api.get('/items'),
      api.get('/categories'),
    ]).then(([r1, r2]) => {
      setItems(r1.data)
      setCategories(r2.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = sortRows(
    items.filter(i => {
      const q = search.toLowerCase()
      const matchSearch = !q || i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
      const matchCat = !catFilter || i.category === catFilter
      return matchSearch && matchCat
    }),
    sortCol, sortDir
  )

  if (loading) return <div className="page-loading">Loading…</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">Browse available items</p>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ width: 260 }}
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          style={{ width: 180 }}
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <SortTh col="name" label="Name" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh col="category" label="Category" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            <SortTh col="unit" label="Unit" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={3} className="empty-row">No items found.</td></tr>
          )}
          {filtered.map(item => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
                {item.unit && <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 6 }}>
                  [{item.unit}]
                </span>}
              </td>
              <td>{item.category || '—'}</td>
              <td>{item.unit ? `[${item.unit}]` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
