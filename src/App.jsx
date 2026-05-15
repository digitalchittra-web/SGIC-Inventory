import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store.jsx'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import InventoryPage from './pages/InventoryPage.jsx'
import InboundPage from './pages/InboundPage.jsx'
import OutboundPage from './pages/OutboundPage.jsx'
import BranchesPage from './pages/BranchesPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import UnitsPage from './pages/UnitsPage.jsx'
import VendorsPage from './pages/VendorsPage.jsx'
import UsersPage from './pages/UsersPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import RequisitionPage from './pages/RequisitionPage.jsx'
import UserInventoryPage from './pages/UserInventoryPage.jsx'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, token } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function InventoryWrapper() {
  const { user } = useAuth()
  return user?.role === 'admin'
    ? <ProtectedRoute adminOnly><InventoryPage /></ProtectedRoute>
    : <UserInventoryPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/requisitions" element={<RequisitionPage />} />
        <Route path="/inventory" element={<InventoryWrapper />} />
        <Route path="/inbound" element={<ProtectedRoute adminOnly><InboundPage /></ProtectedRoute>} />
        <Route path="/outbound" element={<ProtectedRoute adminOnly><OutboundPage /></ProtectedRoute>} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/categories" element={<ProtectedRoute adminOnly><CategoriesPage /></ProtectedRoute>} />
        <Route path="/units" element={<ProtectedRoute adminOnly><UnitsPage /></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute adminOnly><VendorsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute adminOnly><ReportsPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}
