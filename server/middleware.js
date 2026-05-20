import jwt from 'jsonwebtoken'
import { get, run } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'sanima-secret-2024'

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' })
}

export async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await get('SELECT * FROM users WHERE id = $1 AND active = 1', [decoded.userId])

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function adminOnly(req, res, next) {
  if (!['admin', 'user_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export function strictAdminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export async function logAction(userId, action, entityType, entityId, details = null) {
  try {
    await run(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, entityType, entityId, typeof details === 'object' ? JSON.stringify(details) : details]
    )
  } catch (err) {
    console.error('Audit log error:', err)
  }
}
