# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Monit Paper Agency ERP** — Internal admin panel for a paper trading company (Indore). Covers the full paper trading lifecycle: procurement, inventory, sales orders, dispatch planning, invoicing, analytics, and role management.

**Current status:** Phase 1 frontend prototype is complete using mock data. Backend API integration is the next phase.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Icons:** Lucide React
- **Data tables:** @tanstack/react-table + custom DataGrid components
- **Drag & drop:** @dnd-kit

## Development Commands

All commands run from `frontend/`:

```bash
npm run dev      # Start dev server (webpack mode) at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

### Data Layer

All data currently lives in [frontend/data/mockData.ts](frontend/data/mockData.ts). This single file contains:
- All TypeScript interfaces/types for every entity (CustomerInquiry, SalesOrder, GRN, etc.)
- Mock arrays used by every page

When integrating the backend, replace mock data usage with API calls but keep the interfaces in `mockData.ts` or migrate them to a dedicated `types/` directory.

Backend API contracts are documented in [BACKEND_REQUIREMENTS.md](BACKEND_REQUIREMENTS.md).

### Component Architecture

- **`AppShell`** — root layout wrapper combining `Sidebar` + `Header` + `<main>`. Handles mobile sidebar toggle and page fade-in animation on route change.
- **`Sidebar`** — collapsible nav with grouped sections (Sales, Procurement, Logistics, Reports, Masters, Settings). Controls mobile/desktop states.
- **`DataGrid`** — reusable data table built on `@tanstack/react-table`. Use this for all tabular data. Sub-components: `DataGridToolbar`, `DataGridColumnHeader`, `DataGridPagination`.
- **`ReportPageLayout`** — standard wrapper for all report pages with built-in search, column visibility toggle, and CSV export.
- **`forms/`** — one form component per entity (InquiryForm, SalesOrderForm, etc.). Forms in `components/forms/mockData.ts` hold form-specific mock dropdown data separate from main mock data.

### Routing (App Router)

Pages follow the workflow:
1. Inquiry → Sales Order → Coverage
2. Purchase Orders → Mill Tracker → GRN → Stock Lots
3. Dispatch Queue → Pick Plan → Truck Load Plan → Challan → In-Transit

Dashboards at: `/` (Owner), `/dashboard/accounts`, `/dashboard/salesman`, `/dashboard/planner`

Masters at: `/masters/materials`, `/masters/mills`, `/masters/salesmen`, `/masters/rates`, etc.

### Styling Conventions

- Use `cn()` from `lib/utils.ts` for conditional class merging (clsx + tailwind-merge).
- Color utilities are in `components/colors.ts`.
- Tailwind CSS v4 is used — config is in `postcss.config.mjs`, not `tailwind.config.js`.
- Path alias `@/` maps to `frontend/` root (configured in `tsconfig.json`).

## Key Domain Concepts

- **Material code** is auto-composed from: Mill / Category / GSM / Size / Packing — never free-text.
- **Coverage** = physical stock + in-transit stock available against a customer requirement.
- **Challan** = delivery document created from a truck load plan.
- **GRN** = Goods Receipt Note, recorded when material arrives at the godown.
- **Pick Plan** uses FIFO + Bin location logic for warehouse picking.
