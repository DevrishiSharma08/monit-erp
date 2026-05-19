# Monit Paper Agency — Frontend

> Integrated Paper Trading Management System — Admin Panel

## Overview

Internal web-based admin panel for **Monit Paper Sales Agency & Monit Paper Associates**, Indore. Covers the full paper trading lifecycle — procurement tracking, inventory, sales orders, dispatch planning, invoicing, analytics, and user/role management.

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

### Dashboards
| Route | Description |
|-------|-------------|
| `/` | Owner Dashboard — KPIs, sales trend, order pipeline, payment status |
| `/dashboard/accounts` | Accounts Dashboard — invoice stats, monthly chart, payment pie, receivables aging |
| `/dashboard/salesman` | Salesman Dashboard — performance comparison, skill radar, per-salesman cards |
| `/dashboard/planner` | Planner Dashboard — truck load pipeline, mill order status, warehouse stock |

### Sales Workflow
| Route | Description |
|-------|-------------|
| `/inquiry` | Customer Inquiry management — capture, assign, track |
| `/orders` | Sales Orders — create, track, allocate, dispatch |
| `/coverage` | Coverage / customer territory map view |

### Procurement & Logistics
| Route | Description |
|-------|-------------|
| `/purchase-orders` | Purchase Orders to mills — create, track, status updates |
| `/mill-tracker` | Mill Order Tracker — PO-line progress with production status, partial delivery batches |
| `/truck-load-plan` | Truck Load Planner — group orders into truck loads, manage loading sequence |
| `/dispatch-queue` | Dispatch Queue — orders ready for dispatch |
| `/in-transit` | In-Transit tracking — trucks on the road |
| `/grn` | GRN (Goods Receipt Notes) — record material arriving at godown |
| `/challan` | Challan & Loading — delivery challans |
| `/pick-plan` | Pick Plan (FIFO + Bin) — warehouse picking instructions |

### Reports
| Route | Description |
|-------|-------------|
| `/reports/sales-performance/sales-summary` | Sales summary |
| `/reports/sales-performance/customer-wise-volume` | Customer wise volume |
| `/reports/sales-performance/product-wise-sales` | Product wise sales |
| `/reports/sales-performance/salesman-performance` | Salesman performance |
| `/reports/mill-supply/mill-performance` | Mill performance scorecard |
| `/reports/logistics-transport/transporter-performance` | Transporter performance |
| `/reports/finance-inventory/customer-aging` | Customer aging (receivables) |
| `/reports/finance-inventory/inventory-report` | Inventory report |

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

### Settings
| Route | Description |
|-------|-------------|
| `/settings/users` | User Management — add/edit/delete users, assign roles |
| `/settings/roles` | Role Management — define roles with permission sets |
| `/approvals` | Approval workflows |

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

## User Roles

| Role | Access |
|------|--------|
| Admin | Full access to all modules and settings |
| Manager | All read + create/update; no hard-delete |
| Salesman | Inquiry + own Sales Orders + read-only rest |
| Planner | PO + TLP + PickPlan + Challan |
| Accounts | Finance (Phase 2) + read-only rest |
| Warehouse Manager | GRN + Stock + Bin Locations |

---

## Current Status

**Phase 1 — Frontend Prototype: Complete**
**Phase 1 — Backend API Integration: In Progress**

### Integrated with real API
- Authentication (login, refresh, logout, change password)
- Sales Orders (full CRUD + lines)
- Purchase Orders, Mill Tracker, Truck Load Plans
- GRN (Goods Receipt Notes), Stock Lots
- All Masters (Mills, Materials, Customers, Salesmen, Warehouses, Rates, etc.)
- Company Settings / Config

### Still using mock data (pending backend integration)
- Customer Inquiry
- Coverage Engine
- Pick Plan
- Challan
- In-Transit
- All Report pages
- Dashboards (partial — uses mock for chart data)
