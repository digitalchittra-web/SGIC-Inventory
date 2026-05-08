# Sanima GIC Inventory Management System

A complete web-based inventory management application for Sanima GIC Insurance, built with React (frontend) and Express.js (backend).

## 🎯 Features

### Core Modules
- **Dashboard** — Overview with stock value, item count, low-stock alerts, and branch count
- **Inventory** — Manage items (add/edit/delete) with categories and units
- **Inbound (Purchases)** — Record stock purchases from vendors with automatic WAC calculation
- **Outbound (Transfers)** — Transfer stock to branches using Weighted Average Cost
- **Branches** — Manage head office and branch locations
- **Categories** — Create and manage item categories (Stationery, Office Equipment, etc.)
- **Units** — Create and manage units of measure (Box, Ream, Piece, etc.)
- **Vendors** — Manage supplier/vendor directory
- **Users** — Admin-only user management with role assignment
- **Reports** — Admin-only comprehensive reporting with filters

### Role-Based Access
- **Admin**: Full access to all features
- **Staff**: Can view inventory, record purchases (edit/delete own), view branches, access limited reports

### Key Business Logic
- **Weighted Average Cost (WAC)**: Automatically calculated and updated with each purchase
- **Low Stock Alerts**: Configurable alert thresholds per item
- **Audit Trail**: Complete activity logging for compliance
- **Duplicate Prevention**: Prevents duplicate item codes and names
- **Number Formatting**: Indian locale comma separators (10,000; 1,23,456)

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- npm

### Installation

```bash
cd inventory-system
npm install
```

### Running the Application

```bash
npm run dev
```

This starts:
- **Backend** on `http://localhost:3001`
- **Frontend** on `http://localhost:5173`

### Default Login Credentials
```
Email: admin@sanimagic.com
Password: Admin@123
```

## 📁 Project Structure

```
inventory-system/
├── server/                 # Express.js backend
│   ├── index.js           # Server entry point
│   ├── db.js              # SQLite database setup & utilities
│   ├── middleware.js      # Auth, permissions, logging
│   └── routes/            # API endpoints
│       ├── auth.js        # Login/register
│       ├── items.js       # Inventory items
│       ├── inbound.js     # Purchase orders
│       ├── outbound.js    # Stock transfers
│       ├── branches.js    # Branch management
│       ├── categories.js  # Item categories
│       ├── units.js       # Units of measure
│       ├── vendors.js     # Vendor management
│       ├── users.js       # User management
│       └── reports.js     # Reports & analytics
│
├── src/                   # React frontend
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Route definitions
│   ├── api.js            # Axios config
│   ├── store.jsx         # Auth context
│   ├── utils.js          # Formatting utilities
│   ├── index.css         # Global styles
│   ├── components/       # Reusable components
│   │   ├── Layout.jsx    # Sidebar + navigation
│   │   └── Modal.jsx     # Generic modal
│   └── pages/            # Page components
│       ├── LoginPage.jsx
│       ├── Dashboard.jsx
│       ├── InventoryPage.jsx
│       ├── InboundPage.jsx
│       ├── OutboundPage.jsx
│       ├── BranchesPage.jsx
│       ├── CategoriesPage.jsx
│       ├── UnitsPage.jsx
│       ├── VendorsPage.jsx
│       ├── UsersPage.jsx
│       └── ReportsPage.jsx
│
├── index.html            # HTML entry
├── vite.config.js        # Vite config
├── package.json          # Dependencies
└── inventory.db          # SQLite database (auto-created)
```

## 🗄️ Database Schema

### Users
- Login credentials and role assignment (Admin/Staff)
- Branch assignment for staff

### Items
- Inventory master with current quantity and WAC
- Category, unit, vendor, and reorder level

### Inbound
- Purchase orders with unit price and vendor details
- Triggers WAC recalculation

### Outbound
- Stock transfers to branches
- Issued at WAC at time of transfer

### Categories & Units
- Predefined lists for inventory management
- Only items from these lists can be selected

### Branch Stock
- Per-branch inventory tracking

### Audit Log
- Complete activity history for compliance

## 🔐 Security Features

- **JWT Authentication** — Secure token-based login
- **Role-Based Access Control** — Admin-only sections protected
- **Audit Trail** — All actions logged with user and timestamp
- **Duplicate Prevention** — Item codes and names must be unique
- **Input Validation** — All user inputs validated on frontend and backend

## 📊 Reports (Admin Only)

1. **Current Stock** — All items with WAC and total value
2. **Branch Transfers** — History of stock transfers with filters
3. **Low Stock Alerts** — Items below reorder level
4. **User Activity** — Audit log with action, user, and timestamp filters
5. **Purchase History** — Inbound records with vendor and date filters

## 💾 Database Management

SQLite database is auto-created on first run at `inventory.db`.

### Seeding Initial Data
The app automatically seeds on first run:
- **Branches**: Head Office, Kathmandu Branch, Pokhara Branch
- **Categories**: Stationery, Office Equipment, Computer Supplies
- **Units**: Piece, Box, Ream, Pack, Kilogram
- **Admin User**: admin@sanimagic.com / Admin@123

### Backup Database
```bash
# Copy inventory.db to a safe location
cp inventory.db inventory.db.backup
```

## 🛠️ Development

### Building for Production
```bash
npm run build
npm run preview
```

### API Endpoints

**Authentication**
- `POST /api/auth/login` — Login with email/password
- `POST /api/auth/register` — Register new user (admin only after first)

**Inventory**
- `GET /api/items` — All items
- `POST /api/items` — Create item
- `PUT /api/items/:id` — Update item
- `DELETE /api/items/:id` — Delete item

**Categories & Units**
- `GET /api/categories` — All categories
- `GET /api/units` — All units
- `POST /api/categories` — Create category
- `POST /api/units` — Create unit

**Inbound/Outbound**
- `GET /api/inbound` — Purchase history
- `POST /api/inbound` — Record purchase
- `PUT /api/inbound/:id` — Edit purchase (own records only for staff)
- `DELETE /api/inbound/:id` — Delete purchase (own records only for staff)
- `GET /api/outbound` — Transfer history
- `POST /api/outbound` — Create transfer

**Reports**
- `GET /api/reports/stock` — Current stock report
- `GET /api/reports/transfers` — Transfer history
- `GET /api/reports/low-stock` — Low stock items
- `GET /api/reports/activity` — User activity audit log
- `GET /api/reports/inbound-history` — Purchase history

## 🎨 UI/UX Features

- **Clean, professional design** with blue (#185FA5) brand colors
- **Responsive sidebar navigation** with role-based menu items
- **Data tables** with hover effects and warning highlights
- **Modal forms** for add/edit operations
- **Search and filter bars** on all list pages
- **Low stock visual indicators** (amber badges)
- **Number formatting** with Indian locale commas
- **No external UI libraries** — pure HTML/CSS

## 📝 Naming Conventions

- **Item Code**: Unique identifier (e.g., ITM001, ITM002)
- **Item Name**: Unique display name
- **Category**: Must be created first in Categories page
- **Unit**: Must be created first in Units page
- **WAC**: Weighted Average Cost = (Current Value + New Purchase Value) / (Current Qty + New Qty)

## ⚠️ Important Notes

1. **Category & Unit Requirements**: Items require selecting from predefined categories and units. Create these first in their respective pages.
2. **Duplicate Prevention**: Item codes and names cannot be duplicated. System will reject duplicates on save.
3. **Staff Limitations**: Staff users can only edit/delete their own inbound records
4. **WAC Recalculation**: WAC is automatically recalculated whenever inbound records are added/edited/deleted
5. **Transfer Validation**: Cannot transfer more stock than available; system will show error

## 🐛 Troubleshooting

### Server not starting
```bash
# Make sure port 3001 is not in use
lsof -i :3001
```

### Database errors
```bash
# Delete old database and restart to reinitialize
rm inventory.db
npm run dev
```

### Frontend not loading
- Check that Vite server is running on port 5173
- Clear browser cache (Ctrl+Shift+Delete)
- Check browser console for errors (F12)

## 📞 Support

For issues or questions, contact the Sanima GIC development team.

---

**Last Updated**: May 2026
**Version**: 1.0.0
