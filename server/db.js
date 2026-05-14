import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import bcrypt from 'bcryptjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = process.env.NODE_ENV === 'production'
  ? '/tmp/inventory.db'
  : join(__dirname, '..', 'inventory.db')

console.log('DB path:', dbPath)

let db

async function getDB() {
  if (db) return db
  try {
    const Database = (await import('better-sqlite3')).default
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    console.log('Database opened successfully')
    return db
  } catch (err) {
    console.error('Failed to open database:', err)
    throw err
  }
}

export async function run(sql, params = []) {
  const database = await getDB()
  try {
    const stmt = database.prepare(sql)
    const result = stmt.run(...params)
    return { lastID: result.lastInsertRowid, changes: result.changes }
  } catch (err) {
    console.error('SQL run error:', sql, params, err.message)
    throw err
  }
}

export async function get(sql, params = []) {
  const database = await getDB()
  try {
    const stmt = database.prepare(sql)
    return stmt.get(...params)
  } catch (err) {
    console.error('SQL get error:', sql, params, err.message)
    throw err
  }
}

export async function all(sql, params = []) {
  const database = await getDB()
  try {
    const stmt = database.prepare(sql)
    return stmt.all(...params)
  } catch (err) {
    console.error('SQL all error:', sql, params, err.message)
    throw err
  }
}

export async function initDB() {
  await getDB() // ensure DB is open

  // Migration: Add pan_vat column if it doesn't exist
  try { await run(`ALTER TABLE vendors ADD COLUMN pan_vat TEXT`) } catch {}
  try { await run(`ALTER TABLE inbound ADD COLUMN vendor_id INTEGER REFERENCES vendors(id)`) } catch {}
  try { await run(`ALTER TABLE inbound ADD COLUMN fiscal_year_id INTEGER REFERENCES fiscal_years(id)`) } catch {}
  try { await run(`ALTER TABLE outbound ADD COLUMN fiscal_year_id INTEGER REFERENCES fiscal_years(id)`) } catch {}

  await run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await run(`CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    symbol TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await run(`CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    pan_vat TEXT UNIQUE NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await run(`CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','staff')),
    branch_id INTEGER,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(branch_id) REFERENCES branches(id)
  )`)

  await run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT,
    current_qty REAL DEFAULT 0,
    weighted_avg_cost REAL DEFAULT 0,
    vendor_id INTEGER,
    vendor_name TEXT,
    vendor_contact TEXT,
    reorder_level REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await run(`CREATE TABLE IF NOT EXISTS inbound (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    vendor_id INTEGER,
    vendor_name TEXT,
    invoice_no TEXT,
    invoice_date TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES items(id),
    FOREIGN KEY(vendor_id) REFERENCES vendors(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`)

  await run(`CREATE TABLE IF NOT EXISTS outbound (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    destination_branch_id INTEGER NOT NULL,
    issued_cost REAL NOT NULL,
    reference_no TEXT,
    authorized_by TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES items(id),
    FOREIGN KEY(destination_branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`)

  await run(`CREATE TABLE IF NOT EXISTS branch_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity REAL DEFAULT 0,
    UNIQUE(branch_id, item_id),
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(item_id) REFERENCES items(id)
  )`)

  await run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`)

  await run(`CREATE TABLE IF NOT EXISTS reference_sequence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year TEXT UNIQUE NOT NULL,
    next_sequence INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await run(`CREATE TABLE IF NOT EXISTS fiscal_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  const existingFY = await get('SELECT id FROM fiscal_years LIMIT 1')
  if (!existingFY) {
    const now = new Date()
    const m = now.getMonth() + 1
    const y = now.getFullYear()
    const fyStart = m >= 4 ? y : y - 1
    const bsStart = (fyStart + 56) % 100
    const bsEnd = (bsStart + 1) % 100
    const fyName = `${String(bsStart).padStart(2,'0')}/${String(bsEnd).padStart(2,'0')}`
    const result = await run(`INSERT INTO fiscal_years (name, is_active) VALUES (?, 1)`, [fyName])
    await run(`UPDATE inbound SET fiscal_year_id = ? WHERE fiscal_year_id IS NULL`, [result.lastID])
    await run(`UPDATE outbound SET fiscal_year_id = ? WHERE fiscal_year_id IS NULL`, [result.lastID])
    console.log(`Created default fiscal year: ${fyName}`)
  } else {
    const activeFY = await get('SELECT id FROM fiscal_years WHERE is_active = 1')
    if (activeFY) {
      await run(`UPDATE inbound SET fiscal_year_id = ? WHERE fiscal_year_id IS NULL`, [activeFY.id])
      await run(`UPDATE outbound SET fiscal_year_id = ? WHERE fiscal_year_id IS NULL`, [activeFY.id])
    }
  }

  const existingUser = await get('SELECT id FROM users LIMIT 1')
  if (!existingUser) {
    console.log('Seeding initial data...')

    await run(`INSERT OR IGNORE INTO categories (name, description) VALUES ('Stationery', 'Office stationery items')`)
    await run(`INSERT OR IGNORE INTO categories (name, description) VALUES ('Office Equipment', 'Office equipment and furniture')`)
    await run(`INSERT OR IGNORE INTO categories (name, description) VALUES ('Computer Supplies', 'Computer accessories and supplies')`)

    await run(`INSERT OR IGNORE INTO units (name, symbol) VALUES ('Piece', 'pc')`)
    await run(`INSERT OR IGNORE INTO units (name, symbol) VALUES ('Box', 'box')`)
    await run(`INSERT OR IGNORE INTO units (name, symbol) VALUES ('Ream', 'rm')`)
    await run(`INSERT OR IGNORE INTO units (name, symbol) VALUES ('Pack', 'pk')`)
    await run(`INSERT OR IGNORE INTO units (name, symbol) VALUES ('Kilogram', 'kg')`)

    await run(`INSERT OR IGNORE INTO branches (id, name, location) VALUES (1, 'Head Office', 'Kathmandu')`)
    await run(`INSERT INTO branches (name, location) VALUES ('Kathmandu Branch', 'Kathmandu')`)
    await run(`INSERT INTO branches (name, location) VALUES ('Pokhara Branch', 'Pokhara')`)

    const hashedPassword = await bcrypt.hash('Admin@123', 10)
    await run(
      `INSERT INTO users (username, email, password, role, branch_id, active) VALUES (?, ?, ?, ?, ?, ?)`,
      ['admin', 'admin@sanimagic.com', hashedPassword, 'admin', 1, 1]
    )

    await run(`INSERT INTO items (item_code, name, category, unit, current_qty, weighted_avg_cost, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['ITM001', 'A4 Paper', 'Stationery', 'Ream', 0, 0, 5])
    await run(`INSERT INTO items (item_code, name, category, unit, current_qty, weighted_avg_cost, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['ITM002', 'Blue Pen', 'Stationery', 'Box', 0, 0, 10])
    await run(`INSERT INTO items (item_code, name, category, unit, current_qty, weighted_avg_cost, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['ITM003', 'Stapler', 'Office Equipment', 'Piece', 0, 0, 3])

    console.log('Seed data inserted successfully')
  }

  console.log('Database initialized successfully')
}
