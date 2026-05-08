# Setup Guide — Sanima GIC Inventory Management System

## Initial Setup (First Time)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Servers
```bash
npm run dev
```

This will start:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

### 3. Login with Default Admin Account
- **Email**: `admin@sanimagic.com`
- **Password**: `Admin@123`

### 4. Create Your Master Data (IMPORTANT - Do This First!)

Before adding inventory items, create the categories and units that you'll use:

#### Add Categories
1. Go to **Categories** (sidebar, admin only)
2. Click **+ Add Category**
3. Add categories like:
   - Stationery
   - Office Equipment
   - Computer Supplies
   - etc.

#### Add Units
1. Go to **Units** (sidebar, admin only)
2. Click **+ Add Unit**
3. Add units like:
   - Box
   - Ream
   - Piece
   - Pack
   - etc.

### 5. Create Inventory Items
1. Go to **Inventory**
2. Click **+ Add Item**
3. Fill in:
   - **Item Code** (e.g., ITM001) — must be unique
   - **Name** (e.g., A4 Paper) — must be unique
   - **Category** — select from your created categories
   - **Unit** — select from your created units
   - **Low Stock Alert Level** — when quantity falls below this, show warning
4. Click **Save**

### 6. Add Vendors (Optional)
1. Go to **Vendors** (sidebar, admin only)
2. Click **+ Add Vendor**
3. Enter vendor details (name, contact, phone, email, address)

### 7. Record First Purchase
1. Go to **Inbound (Purchase)**
2. Click **+ Record Purchase**
3. Select the item you created
4. Enter:
   - Quantity
   - Unit Price
   - Vendor Name
   - Invoice Number
   - Invoice Date
5. Click **Record Purchase**
   - This will add quantity to your inventory
   - The Weighted Average Cost (WAC) will be set to the unit price

### 8. Create Additional Branches
1. Go to **Branches**
2. Click **+ Add Branch**
3. Enter branch name and location
4. Click **Save**

### 9. Transfer Stock to Branches
1. Go to **Outbound (Transfer)**
2. Click **+ Create Transfer**
3. Select:
   - Item
   - Quantity (system shows available stock)
   - Destination Branch
   - Reference Number (optional)
4. Click **Create Transfer**
   - Stock will be deducted from head office
   - Added to the destination branch
   - Cost is automatically calculated at current WAC

## Daily Operations

### Recording Purchases
1. Supplier sends invoice
2. Go to **Inbound (Purchase)**
3. Record the purchase with actual unit price
4. WAC is automatically recalculated

### Managing Low Stock
1. Check **Dashboard** for low stock alerts
2. Or go to **Inventory** to see items below alert level
3. They're highlighted in amber with "LOW" badge
4. Order from vendors or check **Reports > Low Stock Alerts**

### Transferring Stock Between Branches
1. Go to **Outbound (Transfer)**
2. Create transfer to branch
3. System automatically applies current WAC as cost

### Checking Reports
1. Go to **Reports** (admin only)
2. Available reports:
   - **Current Stock** — all items with costs (searchable)
   - **Branch Transfers** — where stock went (filterable)
   - **Low Stock Alerts** — items to reorder
   - **User Activity** — who did what (audit trail)
   - **Purchase History** — all purchases with filters

## Managing Users

### Adding Staff Users
1. Go to **Users** (admin only)
2. Click **+ Add User**
3. Enter:
   - Username
   - Email
   - Password
   - Role (admin or staff)
   - Branch (optional)
4. Click **Save**

### User Permissions
- **Admin**: Can add/edit/delete all items, view all reports, manage users
- **Staff**: Can add items, view inventory, record their own purchases, view limited reports

## Database & Backups

### Backup Your Data
```bash
# Copy the database file to a safe location
cp inventory.db inventory.db.backup-$(date +%Y%m%d)
```

### Reset Database (Start Over)
```bash
# CAUTION: This deletes all data!
rm inventory.db
npm run dev
# Database will be recreated with default data
```

## Troubleshooting

### "Category name already exists"
- Each category must have a unique name
- Check Categories page for existing categories

### "Item code already exists"
- Item codes must be unique
- Change the code or delete the old item

### "Cannot transfer more stock than available"
- Check current inventory quantity
- Purchase more stock if needed

### Server won't start
- Check if port 3001 is already in use
- Check Node.js is installed: `node --version`

### Database locked error
- Close any other instance of the app
- Delete `inventory.db-wal` and `inventory.db-shm` files if they exist

## Tips & Best Practices

1. **Create Categories First** — Always add categories before adding items
2. **Create Units First** — Always add units before adding items
3. **Use Consistent Item Codes** — Use a prefix like ITM, CAT, etc.
4. **Record Prices Accurately** — The WAC calculation depends on exact purchase prices
5. **Regular Backups** — Backup the database daily or weekly
6. **Audit Reports** — Check User Activity log regularly for compliance
7. **Low Stock Thresholds** — Set realistic alert levels to avoid stockouts

## Quick Commands

```bash
# Start development servers
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check git status
git status

# View git log
git log --oneline
```

---

**Need Help?** Contact the development team or refer to README.md for full documentation.
