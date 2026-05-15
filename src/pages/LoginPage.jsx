import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store.jsx'
import api from '../api.js'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [waking, setWaking] = useState(true)
  const { login } = useAuth()
  const navigate = useNavigate()

  // Ping the backend on load to wake up Render free tier
  useEffect(() => {
    api.get('/auth/ping').catch(() => {}).finally(() => setWaking(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      login(res.data.token, res.data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">📦</div>
          <h1>Sanima GIC Insurance</h1>
          <p>Inventory Management System</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {waking && (
            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: '#f9fafb', borderRadius: 6 }}>
              Connecting to server…
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@sanimagic.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || waking}>
            {loading ? 'Signing in…' : waking ? 'Connecting…' : 'Sign In'}
          </button>
        </form>
        <p className="login-hint">Default: admin@sanimagic.com / Admin@123</p>
      </div>
    </div>
  )
}
