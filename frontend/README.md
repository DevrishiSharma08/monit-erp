# Monit Paper Agency — Frontend

> Integrated Paper Trading Management System — Admin Panel

**Note:** the routes/status tables below are a summary and can drift. The ground truth for which pages are actually active is `components/Sidebar.tsx`'s `NAV_ADMIN` array. See `../HANDOFF.md` for the fuller current-state picture (updated 2026-07-14).

## Overview

Internal web-based admin panel for **Monit Paper Sales Agency & Monit Paper Associates**, Indore (two tenants, separate databases, one codebase). Covers the full paper trading lifecycle — procurement tracking, inventory, sales orders, dispatch planning, invoicing, analytics, and permission management.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| State | React Context API |
| Tables | @tanstack/react-table + custom DataGrid |
| Drag & drop | @dnd-kit |

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Pages & Routes

### Active (Phase 1 — current client scope)

| Route | Description |
|-------|-------------|
| `/` | Dashboard |
| `/orders` | Sales Orders — create, track, allocate, cancel, dispatch |
| `/approvals` | Approval workflow for SO/PO |
| `/purchase-orders` | Purchase Orders to mills — create, track, cancel, status updates |
| `/mill-tracker` | Mill Order Tracker — PO-line progress, production status, close-tracker (short delivery) |
| `/truck-load-plan` | Truck Load Planner — group ready mill-tracker lines into truck loads |
| `/dispatch` | Dispatch — enter dispatch/invoice details for a loaded truck (NOT `/dispatch-queue`, which is a different, hidden, older page) |
| `/grn` | GRN (Goods Receipt Notes) — record material arriving at godown or going direct-to-client |
| `/challan` | Delivery Challan — manually created from the SO page's "Pending SO Closure" KPI |
| `/stock-lots` | Stock Location — FIFO stock lots by bin |
| `/masters/*` | 11 master pages — see below |
| `/settings/company`, `/settings/users`, `/settings/roles` | Company config, user management, permission management |

### Hidden (Phase 2/3 — commented out of `Sidebar.tsx`, not in current client scope)

`/inquiry`, `/coverage`, `/dispatch-queue`, `/pick-plan`, `/in-transit`, `/purchase-invoices`, `/sales-invoices`, `/dashboard/accounts`, `/dashboard/salesman`, `/dashboard/planner`, all `/reports/*`. Some still read from `data/mockData.ts` and were never wired to the real API — that's expected, not a bug.

### Masters

| Route | Description |
|-------|-------------|
| `/masters/materials` | Material Master — paper types, GSM, sizes |
| `/masters/mills` | Mill Master — mill details, contacts, quality |
| `/masters/salesmen` | Salesman Master — territory, targets |
| `/masters/warehouse` | Warehouse / Godown Master |
| `/masters/transporters` | Transporter Master |
| `/masters/rates` | Rate Master — customer-wise price cards |
| `/masters/customers` | Customer Master |
| `/masters/item-type`, `/masters/categories`, `/masters/hsn`, `/masters/localities`, `/masters/instructions` | Remaining master data pages |

---

## Project Structure

```
frontend/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Owner Dashboard
│   ├── orders/                 # Sales Orders
│   ├── purchase-orders/        # Purchase Orders
│   ├── mill-tracker/
│   ├── truck-load-plan/
│   ├── dispatch-queue/
│   ├── grn/
│   ├── masters/
│   └── settings/
├── components/
│   ├── AppShell.tsx            # Root layout (Sidebar + Header + main)
│   ├── Sidebar.tsx             # Collapsible navigation
│   ├── Header.tsx              # Top bar with breadcrumb + notifications
│   ├── Modal.tsx               # Portal modal (responsive, transparent overlay)
│   ├── EmailModal.tsx          # Email composer modal
│   ├── DataGrid.tsx            # Reusable table (sort, filter, pagination)
│   ├── forms/                  # One form per entity
│   │   ├── SalesOrderForm.tsx
│   │   └── ...
│   ├── ui/
│   │   └── ConfirmDialog.tsx   # Confirm/delete dialog
│   └── reports/
│       └── ReportPageLayout.tsx
├── context/
│   ├── AuthContext.tsx          # JWT auth + refresh token
│   ├── SalesOrderContext.tsx    # SO data (real API)
│   ├── PurchaseOrderContext.tsx # PO + MillTracker + TLP (real API)
│   └── CompanySettingsContext.tsx
├── data/
│   └── mockData.ts             # Interfaces + mock arrays for non-integrated pages
├── types/
│   └── paper-domain.ts         # Shared TypeScript types for API-integrated modules
└── lib/
    ├── api.ts                  # apiFetch — JWT headers, 401 refresh, envelope unwrap
    ├── api-services.ts         # Per-resource API helpers
    └── utils.ts                # cn(), formatters
```

---

## Permissions

Authorization is **permission-based, not fixed-role-based**: any user can be granted any combination of permissions (`so.read/write/delete/print`, `po.*`, `mill.*`, `logistics.*`, `grn.*`, `stock.*`, `masters.*`, `approvals.*`, `company.*`, `users.*`, `roles.*`, `dashboard.*`) regardless of a named "role" — managed at `/settings/roles`. The `Admin` role always bypasses every permission check. `Sidebar.tsx` nav items are filtered by the logged-in user's permission set; an action the user lacks permission for shows a friendly toast rather than a raw error. See `../CLAUDE.md` and `../HANDOFF.md` §6 for backend implementation details.

---

## Current Status

**Phase 1 — Backend API Integration: Done, in active client UAT** (treat as a live system — see `../HANDOFF.md`).

### Integrated with real API
- Authentication (login, refresh, logout, change password)
- Sales Orders (full CRUD + lines, cancel, PDF/email/print)
- Purchase Orders, Mill Tracker, Truck Load Plans, Dispatch, Delivery Challan
- GRN (Goods Receipt Notes), Stock Lots
- All Masters (Mills, Materials, Customers, Salesmen, Warehouses, Rates, etc.)
- Company Settings / Config
- Permission management (`/settings/roles`)

### Still using mock data (Phase 2/3, intentionally hidden — see "Hidden" routes above)
- Customer Inquiry, Coverage Engine, Pick Plan, In-Transit, Purchase/Sales Invoices
- All Report pages
- Dashboards other than the root `/` (partial mock use even there for chart data)
