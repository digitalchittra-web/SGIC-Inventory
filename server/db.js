import pg from 'pg'
import bcrypt from 'bcryptjs'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// Unified query wrapper — returns rows array
export async function query(sql, params = []) {
  const client = await pool.connect()
  try {
    const res = await client.query(sql, params)
    return res
  } finally {
    client.release()
  }
}

// Compatibility helpers matching the old sqlite3 API
export async function run(sql, params = []) {
  const res = await query(sql, params)
  return {
    lastID: res.rows[0]?.id || null,
    changes: res.rowCount,
  }
}

export async function get(sql, params = []) {
  const res = await query(sql, params)
  return res.rows[0] || undefined
}

export async function all(sql, params = []) {
  const res = await query(sql, params)
  return res.rows
}

export async function initDB() {
  console.log('Initializing database...')

  await query(`CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS units (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    symbol TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS vendors (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    pan_vat TEXT UNIQUE,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','staff')),
    branch_id INTEGER REFERENCES branches(id),
    department_id INTEGER REFERENCES departments(id),
    active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  // Migration: add department_id column if missing
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)`)
  } catch (e) {
    console.log('department_id migration skipped:', e.message)
  }

  // Migration: allow user_admin role — find and drop any existing role check constraint
  try {
    const constraints = await query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'users'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
    `)
    for (const row of constraints.rows) {
      await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "${row.conname}"`)
    }
    await query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin','staff','user_admin'))`)
  } catch (e) {
    console.log('Role constraint migration skipped:', e.message)
  }

  await query(`CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS inbound (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    vendor_id INTEGER REFERENCES vendors(id),
    vendor_name TEXT,
    invoice_no TEXT,
    invoice_date TEXT,
    fiscal_year_id INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS outbound (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity REAL NOT NULL,
    destination_branch_id INTEGER NOT NULL REFERENCES branches(id),
    issued_cost REAL NOT NULL,
    reference_no TEXT,
    authorized_by TEXT,
    fiscal_year_id INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS branch_stock (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity REAL DEFAULT 0,
    UNIQUE(branch_id, item_id)
  )`)

  await query(`CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS reference_sequence (
    id SERIAL PRIMARY KEY,
    fiscal_year TEXT UNIQUE NOT NULL,
    next_sequence INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS requisitions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','invalid')),
    remarks TEXT,
    reference_no TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS requisition_items (
    id SERIAL PRIMARY KEY,
    requisition_id INTEGER NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    item_name TEXT NOT NULL,
    item_code TEXT NOT NULL,
    unit TEXT,
    quantity INTEGER NOT NULL,
    approved_quantity INTEGER,
    description TEXT
  )`)

  await query(`CREATE TABLE IF NOT EXISTS purchase_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  await query(`CREATE TABLE IF NOT EXISTS purchase_request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    item_name TEXT NOT NULL,
    item_code TEXT NOT NULL,
    unit TEXT,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    vendor_id INTEGER REFERENCES vendors(id),
    vendor_name TEXT,
    invoice_no TEXT,
    invoice_date TEXT
  )`)

  await query(`CREATE TABLE IF NOT EXISTS fiscal_years (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`)

  // Seed fiscal year
  const existingFY = await get('SELECT id FROM fiscal_years LIMIT 1')
  if (!existingFY) {
    const now = new Date()
    const m = now.getMonth() + 1
    const y = now.getFullYear()
    const fyStart = m >= 4 ? y : y - 1
    const bsStart = (fyStart + 56) % 100
    const bsEnd = (bsStart + 1) % 100
    const fyName = `${String(bsStart).padStart(2,'0')}/${String(bsEnd).padStart(2,'0')}`
    await query(`INSERT INTO fiscal_years (name, is_active) VALUES ($1, 1) ON CONFLICT (name) DO NOTHING`, [fyName])
    console.log(`Created default fiscal year: ${fyName}`)
  }

  // Always seed departments if not present
  const existingDept = await get('SELECT id FROM departments LIMIT 1')
  if (!existingDept) {
    for (const dept of ['Admin', 'Underwriting', 'Claim', 'Marketing', 'Reinsurance']) {
      await query(`INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [dept])
    }
    console.log('Seeded departments')
  }

  // Seed data if empty
  const existingUser = await get('SELECT id FROM users LIMIT 1')
  if (!existingUser) {
    console.log('Seeding initial data...')

    await query(`INSERT INTO categories (name, description) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, ['Stationery', 'Office stationery items'])
    await query(`INSERT INTO categories (name, description) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, ['Office Equipment', 'Office equipment and furniture'])
    await query(`INSERT INTO categories (name, description) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, ['Computer Supplies', 'Computer accessories and supplies'])

    await query(`INSERT INTO units (name, symbol) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, ['Piece', 'pc'])
    await query(`INSERT INTO units (name, symbol) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, ['Box', 'box'])
    await query(`INSERT INTO units (name, symbol) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, ['Ream', 'rm'])
    await query(`INSERT INTO units (name, symbol) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, ['Pack', 'pk'])
    await query(`INSERT INTO units (name, symbol) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, ['Kilogram', 'kg'])

    await query(`INSERT INTO branches (name, location) VALUES ($1,$2) ON CONFLICT DO NOTHING`, ['Head Office', 'Kathmandu'])
    await query(`INSERT INTO branches (name, location) VALUES ($1,$2)`, ['Kathmandu Branch', 'Kathmandu'])
    await query(`INSERT INTO branches (name, location) VALUES ($1,$2)`, ['Pokhara Branch', 'Pokhara'])

    for (const dept of ['Admin', 'Underwriting', 'Claim', 'Marketing', 'Reinsurance']) {
      await query(`INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [dept])
    }

    const hashedPassword = await bcrypt.hash('Admin@123', 10)
    const branchRes = await query(`SELECT id FROM branches WHERE name = 'Head Office' LIMIT 1`)
    const branchId = branchRes.rows[0]?.id || 1
    await query(`INSERT INTO users (username, email, password, role, branch_id, active) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
      ['admin', 'admin@sanimagic.com', hashedPassword, 'admin', branchId, 1])

    await query(`INSERT INTO items (item_code, name, category, unit, current_qty, weighted_avg_cost, reorder_level) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (item_code) DO NOTHING`,
      ['ITM001', 'A4 Paper', 'Stationery', 'Ream', 0, 0, 5])
    await query(`INSERT INTO items (item_code, name, category, unit, current_qty, weighted_avg_cost, reorder_level) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (item_code) DO NOTHING`,
      ['ITM002', 'Blue Pen', 'Stationery', 'Box', 0, 0, 10])
    await query(`INSERT INTO items (item_code, name, category, unit, current_qty, weighted_avg_cost, reorder_level) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (item_code) DO NOTHING`,
      ['ITM003', 'Stapler', 'Office Equipment', 'Piece', 0, 0, 3])

    console.log('Seed data inserted successfully')
  }

  console.log('Database initialized successfully')
}
