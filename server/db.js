import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import bcrypt from 'bcrypt'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'inventory.db')

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err)
  } else {
    console.log('Connected to SQLite database at', dbPath)
  }
})

db.run('PRAGMA journal_mode=WAL')
db.run('PRAGMA foreign_keys=ON')

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

export async function initDB() {
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
    vendor_name TEXT,
    invoice_no TEXT,
    invoice_date TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES items(id),
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

  // Seed data if empty
  const existingUser = await get('SELECT id FROM users LIMIT 1')
  if (!existingUser) {
    console.log('Seeding initial data...')

    // Seed categories
    await run(`INSERT OR IGNORE INTO categories (name, description) VALUES ('Stationery', 'Office stationery items')`)
    await run(`INSERT OR IGNORE INTO categories (name, description) VALUES ('Office Equipment', 'Office equipment and furniture')`)
    await run(`INSERT OR IGNORE INTO categories (name, description) VALUES ('Computer Supplies', 'Computer accessories and supplies')`)

    // Seed units
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

    await run(
      `INSERT INTO items (item_code, name, category, unit, current_qty, weighted_avg_cost, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['ITM001', 'A4 Paper', 'Stationery', 'Ream', 0, 0, 5]
    )
    await run(
      `INSERT INTO items (item_code, name, category, unit, current_qty, weighted_avg_cost, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['ITM002', 'Blue Pen', 'Stationery', 'Box', 0, 0, 10]
    )
    await run(
      `INSERT INTO items (item_code, name, category, unit, current_qty, weighted_avg_cost, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['ITM003', 'Stapler', 'Office Equipment', 'Piece', 0, 0, 3]
    )

    console.log('Seed data inserted successfully')
  }
}
