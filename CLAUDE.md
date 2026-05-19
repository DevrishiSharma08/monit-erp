# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Monit Paper Agency ERP** — Internal admin panel for a paper trading company (Indore). Covers the full paper trading lifecycle: procurement, inventory, sales orders, dispatch planning, invoicing, analytics, and role management.

**Current status:** Phase 1 backend integration is in progress. Procurement + Sales Order flow (SO, PO, Approvals, Mill Tracker) is connected to the .NET 8 API. Email dispatch (MailKit) and PDF generation (QuestPDF) are fully implemented. Pages not yet integrated still use mock data from `mockData.ts`.

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

**Integrated pages** use `lib/api-services.ts` which contains typed `fetch` wrappers for every backend endpoint. The backend is a .NET 8 API (Dapper + MSSQL) running at `http://localhost:5000`.

**Non-integrated pages** still read from `frontend/data/mockData.ts`, which holds all TypeScript interfaces and mock arrays. When integrating a page, replace mock data reads with API calls from `api-services.ts`.

**Key utilities:**
- `lib/api-services.ts` — all API call functions, typed request/response interfaces
- `lib/emailSentCache.ts` — localStorage cache for email-sent state (shared across SO, PO, Approvals pages)

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

## Backend Services (Phase 1 Complete)

- **Email** — MailKit 4.9.0, Gmail App Password via SMTP StartTLS on port 587. SMTP credentials stored in `system.CompanyConfig` (Id=1). Sending attaches a PDF of the SO/PO.
- **PDF generation** — QuestPDF 2024.12.0 (Community license). `SalesOrderPdfService` and `PurchaseOrderPdfService` in `Backend/Monit.API/Services/`.
- **PO rate logic** — PO stores `Rate` as the final (post-discount) rate; base rate back-calculated as `Rate / (1 - Discount/100)` for display in emails and PDF.
- **SO rate logic** — SO stores `Rate` as the base (pre-discount) rate; `Discount` is a ₹ amount; `FinalPrice = Rate - Discount`.
- **Company Config** — `system.CompanyConfig` singleton (Id=1). MERGE SQL uses "null = keep existing, empty string = clear" pattern so saving one section (e.g. SMTP) never overwrites another section (e.g. Insurance).
- **EmailSentAt** — both SO and PO tables have `EmailSentAt` column. Frontend `emailSentCache.ts` persists sent IDs in localStorage so the "Mail Sent ✓" state is consistent across page navigations and the Approvals page.
