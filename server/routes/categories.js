import express from 'express'
import { run, get, all } from '../db.js'
import { auth, adminOnly, logAction } from '../middleware.js'

const router = express.Router()

router.get('/', auth, async (req, res) => {
  try {
    const categories = await all('SELECT * FROM categories ORDER BY name')
    res.json(categories)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'Category name is required' })

    const dup = await get('SELECT id FROM categories WHERE name = ?', [name])
    if (dup) return res.status(400).json({ error: 'Category name already exists' })

    const result = await run(
      `INSERT INTO categories (name, description) VALUES (?, ?)`,
      [name, description || null]
    )
    await logAction(req.user.id, 'CREATE', 'category', result.lastID, `Created category: ${name}`)
    res.status(201).json({ id: result.lastID, name, message: 'Category created successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'Category name is required' })

    const cat = await get('SELECT id FROM categories WHERE id = ?', [id])
    if (!cat) return res.status(404).json({ error: 'Category not found' })

    const dup = await get('SELECT id FROM categories WHERE name = ? AND id != ?', [name, id])
    if (dup) return res.status(400).json({ error: 'Category name already exists' })

    await run(
      `UPDATE categories SET name = ?, description = ? WHERE id = ?`,
      [name, description || null, id]
    )
    await logAction(req.user.id, 'UPDATE', 'category', id, `Updated category: ${name}`)
    res.json({ message: 'Category updated successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const cat = await get('SELECT * FROM categories WHERE id = ?', [id])
    if (!cat) return res.status(404).json({ error: 'Category not found' })

    await run('DELETE FROM categories WHERE id = ?', [id])
    await logAction(req.user.id, 'DELETE', 'category', id, `Deleted category: ${cat.name}`)
    res.json({ message: 'Category deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
