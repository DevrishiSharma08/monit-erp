# Monit Paper Agency — Command System

> Integrated Paper Trading Management System — Frontend (Admin Panel)

## Overview

This is the internal web-based admin panel for **Monit Paper Sales Agency & Monit Paper Associates**, Indore. It covers the full paper trading lifecycle — procurement tracking, inventory, sales orders, dispatch planning, invoicing, analytics, and user/role management.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Data | Mock data (`/data/mockData.ts`) — backend integration pending |

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
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

### Invoice Tracker
| Route | Description |
|-------|-------------|
| `/purchase-invoices` | Purchase Invoices from mills |
| `/sales-invoices` | Sales Invoices to customers |

### Reports
| Route | Description |
|-------|-------------|
| `/reports/sales-performance/sales-summary` | Sales summary report |
| `/reports/sales-performance/customer-wise-volume` | Customer wise volume |
| `/reports/sales-performance/product-wise-sales` | Product wise sales |
| `/reports/sales-performance/quality-wise-sales-trend` | Quality wise sales trend |
| `/reports/sales-performance/salesman-performance` | Salesman performance |
| `/reports/sales-performance/target-vs-order-lifted` | Target vs order lifted |
| `/reports/sales-performance/inquiry-conversion-funnel` | Inquiry conversion funnel |
| `/reports/mill-supply/mill-performance` | Mill performance scorecard |
| `/reports/mill-supply/product-against-supply` | Product against supply |
| `/reports/mill-supply/customer-order-by-mill` | Customer order by mill |
| `/reports/mill-supply/product-ready-vs-transport-delay` | Product ready vs transport delay |
| `/reports/logistics-transport/transporter-performance` | Transporter performance |
| `/reports/logistics-transport/in-transit-delay-report` | In-transit delay report |
| `/reports/finance-inventory/customer-aging` | Customer aging (receivables) |
| `/reports/finance-inventory/inventory-report` | Inventory report |

### Masters
| Route | Description |
|-------|-------------|
| `/masters/materials` | Material Master — paper types, GSM, sizes |
| `/masters/categories` | Category Master |
| `/masters/mills` | Mill Master — mill details, TAT, products |
| `/masters/salesmen` | Salesman Master — territory, monthly targets |
| `/masters/warehouse` | Warehouse / Godown Master |
| `/masters/transporters` | Transporter Master |
| `/masters/rates` | Rate Master — customer-wise price cards |
| `/bin-locations` | Bin Location Master |
| `/customers` | Customer Master |

### Settings
| Route | Description |
|-------|-------------|
| `/settings` | App Settings overview |
| `/settings/users` | User Management — add/edit/delete users, assign roles |
| `/settings/roles` | Role Management — define roles with permission sets |
| `/settings/teams` | Team Management — organize users into teams with territories |

---

## Project Structure

```
frontend/
├── app/                        # Next.js App Router pages
│   ├── (dashboard pages)
│   ├── (report pages)
│   ├── (workflow pages)
│   ├── masters/
│   └── settings/
│       ├── users/
│       ├── roles/
│       └── teams/
├── components/
│   ├── Sidebar.tsx             # Main navigation sidebar
│   ├── Header.tsx              # Top bar with breadcrumb
│   ├── DataGrid.tsx            # Reusable data table with sort/filter
│   └── reports/
│       └── ReportPageLayout.tsx # Report page wrapper (search, filters, column toggle, CSV export)
├── data/
│   └── mockData.ts             # All mock data & TypeScript interfaces
└── lib/
    └── utils.ts                # Utility functions (cn, formatters)
```

---

## User Roles

| Role | Description |
|------|-------------|
| Admin | Full access to all modules and settings |
| Manager | Sales, orders, dispatch, reporting |
| Salesman | Orders, inquiry, customer interaction |
| Accountant | Invoices, payments, financial reports |
| Planner | Dispatch, GRN, stock, mill tracker |
| Warehouse Manager | Stock, GRN, bin locations |
| Driver | View-only dispatch access |

---

## Current Status

**Phase 1 — Frontend Prototype: Complete**

All major modules have been built as functional frontend prototypes using mock data. Backend API integration is the next phase.

- All workflow pages implemented with full CRUD UI
- 4 role-based dashboards (Owner, Accounts, Salesman, Planner)
- 15 report pages with search, column visibility toggle, and CSV export
- Settings module: User, Role, and Team Management
- Responsive sidebar with collapsible navigation
