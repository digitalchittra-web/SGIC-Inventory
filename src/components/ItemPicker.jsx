import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ItemPicker({
  items,
  value,
  onChange,
  disabled,
  placeholder = 'Select…',
  getSubLabel = null,
  searchKeys = null,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [popupStyle, setPopupStyle] = useState({})
  const buttonRef = useRef(null)
  const searchRef = useRef(null)
  const popupRef = useRef(null)

  const selected = items.find(i => String(i.id) === String(value))

  function subLabel(item) {
    if (getSubLabel) return getSubLabel(item)
    let parts = []
    if (item.item_code) parts.push(item.item_code)
    if (item.current_qty !== undefined) parts.push(`Available: ${item.current_qty} ${item.unit || ''}`)
    return parts.join(' · ')
  }

  function searchText(item) {
    if (searchKeys) return searchKeys(item).toLowerCase()
    return `${item.name} ${subLabel(item)}`.toLowerCase()
  }

  const filtered = items.filter(i => !search || searchText(i).includes(search.toLowerCase()))

  function openPopup() {
    if (disabled) return
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const popupHeight = 320
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow >= popupHeight
        ? rect.bottom + 4
        : rect.top - popupHeight - 4
      setPopupStyle({
        position: 'fixed',
        top,
        left: rect.left,
        width: Math.max(rect.width, 380),
        zIndex: 99999,
      })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    function handleOutside(e) {
      const clickedInsideButton = buttonRef.current?.closest('[data-itempicker]')?.contains(e.target)
      const clickedInsidePopup = popupRef.current?.contains(e.target)
      if (!clickedInsideButton && !clickedInsidePopup) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside)
      return () => document.removeEventListener('mousedown', handleOutside)
    }
  }, [open])

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus()
  }, [open])

  function handleSelect(item) {
    onChange(String(item.id))
    setOpen(false)
    setSearch('')
  }

  const sub = selected ? subLabel(selected) : null

  return (
    <div data-itempicker style={{ position: 'relative', width: '100%' }}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={openPopup}
        style={{
          width: '100%',
          padding: '9px 12px',
          border: `1px solid ${open ? '#185FA5' : '#e5e7eb'}`,
          borderRadius: 6,
          background: disabled ? '#f5f5f5' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          fontSize: 13.5,
          color: selected ? '#1a1a2e' : '#9ca3af',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          boxShadow: open ? '0 0 0 3px rgba(24,95,165,0.1)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          minHeight: 40,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selected ? (
            <>
              <strong>{selected.name}</strong>
              {sub && <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 6 }}>{sub}</span>}
            </>
          ) : placeholder}
        </span>
        <span style={{ color: '#9ca3af', fontSize: 10, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Popup — rendered via portal to escape modal/table constraints */}
      {open && createPortal(
        <div
          ref={popupRef}
          style={{
            ...popupStyle,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
            maxHeight: 320,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 99999,
          }}
        >
          {/* Search box */}
          <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid #f0f0f0' }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 && (
              <div style={{ padding: '16px 12px', color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>
                No results found
              </div>
            )}
            {filtered.map(item => {
              const isSelected = String(item.id) === String(value)
              const sl = subLabel(item)
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  style={{
                    padding: '9px 14px',
                    cursor: 'pointer',
                    background: isSelected ? '#e6f1fb' : 'transparent',
                    borderBottom: '1px solid #f5f5f5',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fbff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#e6f1fb' : 'transparent' }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: isSelected ? 600 : 400, color: '#1a1a2e' }}>
                      {item.name}
                    </div>
                    {sl && (
                      <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1 }}>{sl}</div>
                    )}
                  </div>
                  {isSelected && <span style={{ color: '#185FA5', fontSize: 14, fontWeight: 700, marginLeft: 8 }}>✓</span>}
                </div>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
