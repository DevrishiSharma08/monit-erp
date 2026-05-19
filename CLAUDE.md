# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Monit Paper Agency ERP** — Internal admin panel for a paper trading company (Indore). Covers the full paper trading lifecycle: procurement, inventory, sales orders, dispatch planning, invoicing, analytics, and role management.

**Current status:** Phase 1 frontend prototype is complete. Backend API integration is in progress — Auth, Sales Orders, Purchase Orders, Mill Tracker, Truck Load Plans, GRN, Stock Lots, Masters, and Company Settings are fully integrated with the real API. Remaining pages (Inquiry, Coverage, Pick Plan, Challan, In-Transit, Reports) still use mock data.

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Icons:** Lucide React
- **Data tables:** @tanstack/react-table + custom DataGrid components
- **Drag & drop:** @dnd-kit

### Backend
- **Framework:** .NET 8 Web API
- **Data access:** Dapper (micro-ORM, raw SQL)
- **Database:** SQL Server (MSSQL)
- **Auth:** JWT Bearer + HttpOnly refresh token cookie
- **Password hashing:** BCrypt.Net-Next 4.0.3
- **Export:** ClosedXML (Excel), iTextSharp (PDF), DocumentFormat.OpenXml (Word)

## Development Commands

Frontend — run from `frontend/`:
```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

Backend — run from `Backend/Monit.API/`:
```bash
dotnet run       # Start API at https://localhost:7xxx
dotnet build     # Build only
```

## Architecture

### Data Layer

Mock data lives in [frontend/data/mockData.ts](frontend/data/mockData.ts). Pages that are not yet API-integrated still consume this file directly.

Shared TypeScript types for API-integrated pages are in [frontend/types/paper-domain.ts](frontend/types/paper-domain.ts).

All API calls go through [frontend/lib/api.ts](frontend/lib/api.ts) (`apiFetch`) which handles JWT auth headers, 401 refresh, and the `ApiResponse<T>` envelope unwrapping. Higher-level resource helpers are in [frontend/lib/api-services.ts](frontend/lib/api-services.ts).

Backend API contracts are documented in [BACKEND_REQUIREMENTS.md](BACKEND_REQUIREMENTS.md).

### Backend Structure (actual, single-project)

```
Backend/Monit.API/
├── Controllers/
│   ├── Auth/          AuthController, UsersController, RolesController
│   ├── Masters/       Mills, Materials, Customers, Salesmen, Warehouses,
│   │                  Transporters, Rates, PaperSizes, StockGroups,
│   │                  StockCategories, ItemTypes, Units, HSN, Localities, MQG, Instructions
│   ├── Sales/         SalesOrdersController
│   ├── Procurement/   PurchaseOrdersController, MillTrackerController, TruckLoadPlanController
│   ├── Inventory/     GrnController, StockLotsController
│   └── System/        CompanyConfigController, DashboardController
├── Services/          One service per domain (Auth, Masters, Sales, Procurement, Inventory, System)
├── Repositories/      Dapper-based; one repo per entity
├── Models/
│   ├── DTOs/          Request/response shapes per module
│   └── Entities/      POCO domain models
├── Common/
│   ├── Middleware/    ExceptionMiddleware (global error → ApiResponse)
│   ├── Helpers/       AppConfig, DependencyInjection
│   └── Response/      ApiResponse<T>, PagedResult<T>, FilterRequest
└── Data/              DbConnectionFactory, DateOnlyTypeHandler
```

### Component Architecture

- **`AppShell`** — root layout wrapper combining `Sidebar` + `Header` + `<main>`. Handles mobile sidebar toggle and page fade-in animation on route change.
- **`Sidebar`** — collapsible nav with grouped sections (Sales, Procurement, Logistics, Reports, Masters, Settings). Controls mobile/desktop states.
- **`DataGrid`** — reusable data table built on `@tanstack/react-table`. Use this for all tabular data. Sub-components: `DataGridToolbar`, `DataGridColumnHeader`, `DataGridPagination`.
- **`ReportPageLayout`** — standard wrapper for all report pages with built-in search, column visibility toggle, and CSV export.
- **`Modal`** — portal-based modal; responsive sizing via `size` prop (`sm/md/lg/xl/2xl`); overlay is `bg-white/10` (transparent).
- **`ConfirmDialog`** — portal-based confirm; locks body scroll; overlay is `bg-white/10`.
- **`EmailModal`** — portal-based email composer.
- **`forms/`** — one form component per entity (InquiryForm, SalesOrderForm, etc.). Forms in `components/forms/mockData.ts` hold form-specific mock dropdown data separate from main mock data.

### Context Providers

| Context | Data source | Notes |
|---|---|---|
| `AuthContext` | Real API | JWT + refresh token; exposes `user`, `login`, `logout`, `changePassword` |
| `SalesOrderContext` | Real API | Full SO + lines; exposes `reload()` |
| `PurchaseOrderContext` | Real API | PO + MillTracker + TruckLoadPlan; exposes `reload()` |
| `CompanySettingsContext` | Real API | Company config; exposes `config`, `loading`, `error`, `reload` |

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
- All modals use `100dvh` (not `100vh`) for correct mobile browser chrome handling.

## Key Domain Concepts

- **Material code** is auto-composed from: Mill / Category / GSM / Size / Packing — never free-text.
- **Coverage** = physical stock + in-transit stock available against a customer requirement.
- **Challan** = delivery document created from a truck load plan.
- **GRN** = Goods Receipt Note, recorded when material arrives at the godown.
- **Pick Plan** uses FIFO + Bin location logic for warehouse picking.
- **FULL_ACCESS_ROLES** = `["Admin", "Manager"]` — used for field-level masking (`canViewCosts`, `canViewContacts`).

## API Conventions

- All responses are wrapped in `ApiResponse<T>` — `apiFetch` unwraps `body.data` automatically.
- Paginated responses return `PagedResult<T>` (backend) → `Paged<T>` (frontend camelCase).
- Standard error shape: `{ success: false, message: string, errors: string[] }`.
- Auth endpoints: `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`, `/api/v1/auth/me`, `/api/v1/auth/change-password`.
- 401 refresh retry is guarded by `_retried` flag in `apiFetch` to prevent infinite loops.
