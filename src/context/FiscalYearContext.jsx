import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api.js'
import { useAuth } from '../store.jsx'

const FiscalYearContext = createContext(null)

export function FiscalYearProvider({ children }) {
  const { token } = useAuth()
  const [fiscalYears, setFiscalYears] = useState([])
  const [activeFiscalYear, setActiveFiscalYear] = useState(null)
  const [viewingFiscalYear, setViewingFiscalYear] = useState(null) // null = active year

  function fetchFiscalYears() {
    api.get('/fiscal-years').then(r => {
      setFiscalYears(r.data)
      const active = r.data.find(y => y.is_active)
      setActiveFiscalYear(active || null)
      // If viewingFiscalYear not set yet, default to active
      setViewingFiscalYear(prev => prev === null ? (active || null) : prev)
    }).catch(console.error)
  }

  useEffect(() => { if (token) fetchFiscalYears() }, [token])

  const viewingId = viewingFiscalYear?.id || activeFiscalYear?.id || null

  return (
    <FiscalYearContext.Provider value={{ fiscalYears, activeFiscalYear, viewingFiscalYear, setViewingFiscalYear, viewingId, refetch: fetchFiscalYears }}>
      {children}
    </FiscalYearContext.Provider>
  )
}

export function useFiscalYear() {
  return useContext(FiscalYearContext)
}
