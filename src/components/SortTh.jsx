/**
 * Sortable table header cell.
 * Shows ○ when unsorted, ▲ ascending, ▼ descending.
 */
export function SortTh({ col, label, sortCol, sortDir, onSort, style = {} }) {
  const active = sortCol === col
  const icon = active ? (sortDir === 'asc' ? '▲' : '▼') : '●'
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}{' '}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: active ? 0 : '50%',
        fontSize: active ? 8 : 7,
        color: active ? '#185FA5' : '#9ca3af',
        border: active ? 'none' : '1.5px solid #d1d5db',
        marginLeft: 4,
        verticalAlign: 'middle',
        transition: 'all 0.15s',
      }}>
        {icon}
      </span>
    </th>
  )
}

/**
 * Sort an array by a key. Auto-detects string vs number.
 */
export function sortRows(rows, col, dir) {
  if (!col) return rows
  return [...rows].sort((a, b) => {
    const av = a[col] ?? ''
    const bv = b[col] ?? ''
    let cmp
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv
    } else {
      const as = String(av).toLowerCase()
      const bs = String(bv).toLowerCase()
      cmp = as < bs ? -1 : as > bs ? 1 : 0
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

/**
 * Returns sort state + handler. Use inside a component.
 * onSort(col) toggles asc/desc or sets new col (asc).
 */
export function useSortState() {
  // Return initial values — caller must use useState externally.
  // Usage: const [sortCol, setSortCol, sortDir, setSortDir, onSort] = useSortControls()
}

export function makeOnSort(sortCol, setSortCol, sortDir, setSortDir) {
  return function onSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }
}
