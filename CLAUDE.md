# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Also read [HANDOFF.md](HANDOFF.md)** — a deeper "current state of the world" briefing (business flow, recent feature history, parked/deferred items, known gotchas, deployment notes). This file (CLAUDE.md) is the shorter, code-convention-focused companion.

## Project Overview

**Monit Paper Agency ERP** — Internal admin panel for a paper trading company (Indore), serving two tenant entities (Monit Paper Sales Agency / Monit Paper Associates) on separate databases from one codebase. Covers the full paper trading lifecycle: procurement, inventory, sales orders, dispatch planning, invoicing, analytics, and role management.

**Current status:** Phase 1 (procurement + full sales-order flow: SO, PO, Approvals, Mill Tracker, Truck Load Plan, Dispatch, GRN, Stock Lots, Delivery Challan) is backend-integrated and in active client UAT — treat this as a live system. Phase 2 (Inquiry, Coverage, Pick Plan, In-Transit, Invoices) and Phase 3 (Dashboards, Reports, CRM) exist in code but are intentionally hidden from the sidebar — not in current scope, don't re-enable without being asked. Permission-based authorization (not role-name-based) now gates nearly every write/delete action — see "Permission System" below. Pages not yet integrated (the hidden Phase 2/3 ones) still use mock data from `mockData.ts`.

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
- **Framework:** .NET 10 Web API
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

**Integrated pages** use `lib/api-services.ts` which contains typed `fetch` wrappers for every backend endpoint. The backend is a .NET 10 API (Dapper + MSSQL) running at `http://localhost:5000`.

**Non-integrated pages** still read from `frontend/data/mockData.ts`, which holds all TypeScript interfaces and mock arrays. When integrating a page, replace mock data reads with API calls from `api-services.ts`.

**Key utilities:**
- `lib/api-services.ts` — all API call functions, typed request/response interfaces
- `lib/emailSentCache.ts` — localStorage cache for email-sent state (shared across SO, PO, Approvals pages)

[BACKEND_REQUIREMENTS.md](BACKEND_REQUIREMENTS.md) is the *original pre-build* requirements doc (endpoint paths and table designs there predate what was actually implemented and have drifted — e.g. it shows `/api/sales-orders` without the `/v1/` prefix, and a `Challans` table design that isn't what got built as `inventory.DeliveryChallans`). For the as-built contract, read the actual controllers under `Controllers/` plus `Database/*.sql`, or see [HANDOFF.md](HANDOFF.md) §10 for a full doc-trust-level breakdown.

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
│   ├── Inventory/     GrnController, StockLotsController, DispatchReceiptsController, DeliveryChallansController
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
- **`Sidebar`** — collapsible nav (`NAV_ADMIN` array in `Sidebar.tsx`). Active Phase 1 pages are flat leaf links; `Masters` and `Settings` are the only grouped sections. Phase 2/3 items exist in the same array, commented out. Each leaf/section can carry a `perm` field that filters it against the logged-in user's permission set.
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

**The ground truth for which pages are actually active is `frontend/components/Sidebar.tsx`'s `NAV_ADMIN` array** — everything else (this file, `frontend/README.md`) is a summary that can drift.

Active (Phase 1) workflow: Sales Order (`/orders`) → Purchase Order (`/purchase-orders`, raised "Against SO" or "For Stock") → Mill Order Tracker (`/mill-tracker`) → Truck Load Planner (`/truck-load-plan`) → Dispatch (`/dispatch`) → GRN (`/grn`) → Stock Location (`/stock-lots`) → Delivery Challan (`/challan`, manually created from the SO page's "Pending SO Closure" KPI — see HANDOFF.md §5 for why auto-DC was deliberately removed).

Dashboard at `/` only. Masters at `/masters/materials`, `/masters/mills`, `/masters/salesmen`, `/masters/rates`, etc. (11 master pages total). Settings at `/settings/company`, `/settings/users`, `/settings/roles`.

**Hidden (Phase 2/3, commented out of Sidebar — do not re-enable without being asked):** `/inquiry`, `/coverage`, `/dispatch-queue` (a different, older page than the active `/dispatch` — don't confuse them), `/pick-plan`, `/in-transit`, `/purchase-invoices`, `/sales-invoices`, `/dashboard/accounts`, `/dashboard/salesman`, `/dashboard/planner`, all `/reports/*`.

### Styling Conventions

- Use `cn()` from `lib/utils.ts` for conditional class merging (clsx + tailwind-merge).
- Color utilities are in `components/colors.ts`.
- Tailwind CSS v4 is used — config is in `postcss.config.mjs`, not `tailwind.config.js`.
- Path alias `@/` maps to `frontend/` root (configured in `tsconfig.json`).
- All modals use `100dvh` (not `100vh`) for correct mobile browser chrome handling.

## Permission System

Authorization is **permission-based, not role-name-based**: any user with the right permission can perform the action regardless of their named role; missing permission → friendly toast, not a crash. Implemented via `Backend/Monit.API/Common/Middleware/RequirePermAttribute.cs` — `[RequirePerm("so.write")]` etc. on controller actions, checks a `perm` JWT claim, Admin role always bypasses. Permission catalog (groups like `so.*`, `po.*`, `mill.*`, `logistics.*`, `grn.*`, `stock.*`, `masters.*`, each with `read/write/delete/print`) lives in `Backend/Monit.API/Services/Auth/RoleService.cs` (`AvailablePermissions`). `UsersController`/`RolesController` stay `[Authorize(Roles = "Admin")]`-only on purpose. Frontend `Sidebar.tsx` nav items carry a matching `perm` field; denied actions surface via the global `unhandledrejection` listener in `context/ToastContext.tsx`. Follow this exact pattern for any new gated endpoint — see HANDOFF.md §6 for more detail.

## Key Domain Concepts

- **Material code** is auto-composed from: Mill / Category / GSM / Size / Packing — never free-text.
- **Coverage** = physical stock + in-transit stock available against a customer requirement. (Phase 2, currently hidden.)
- **Challan** (Delivery Challan) = document created manually from the SO page's "Pending SO Closure" KPI once goods have a GRN/stock lot — closes the SO when fully delivered.
- **GRN** = Goods Receipt Note, recorded when material arrives at the godown (or goes direct-to-client). Treated as **immutable after creation** — corrections are a new GRN, not an edit.
- **Pick Plan** uses FIFO + Bin location logic for warehouse picking. (Phase 2, currently hidden.)
- **Weight vs. sheet-count**: a SO/PO line's "quantity" can be sheets or kg depending on how it was entered. Never trust a stored "kg" field at face value — recompute independently via `Backend/Monit.API/Common/Helpers/WeightCalculator.cs` (backend) or `frontend/lib/weight.ts`'s `lineWeightKg()` (frontend) any time you read a quantity/weight field. See HANDOFF.md §5 for the full story — this exact bug class has already been found and fixed twice (SO PDF, Delivery Challan repository).
- **Cancel vs. Delete**: SO and PO both support a "Cancel" action (3-dot menu, mandatory reason) distinct from Delete — Cancel keeps the row/number/history intact and greys it out (`Status = 'Cancelled'`, `DataGrid`'s `dimRow` prop), Delete soft-removes it. Don't conflate the two when asked to touch either.
- **Order-Placed edit lock**: Material/GSM/Size/Quantity on SO lines and PO items are only editable while the linked Mill Tracker record is still exactly `"Order Placed"` — once production has progressed, the backend rejects changes to those fields via `ValidationException`. See HANDOFF.md §5.

## Database Conventions

- **Soft-delete only**: every table uses an `IsDeleted` bit; there is no hard `DELETE` anywhere in the app. Numbered idempotent migrations live in `Database/` (currently up to `48_filter_remaining_unique_constraints_on_isdeleted.sql`).
- **Filtered unique index, not plain UNIQUE**: any business-meaningful unique column on a soft-delete table (material code, mill name, SO/PO number, etc.) must use `CREATE UNIQUE INDEX ... WHERE IsDeleted = 0`, never a plain `UNIQUE` constraint — a plain constraint permanently blocks reusing a deleted row's key. This was audited system-wide (31 constraints fixed across masters/auth/sales/procurement/inventory/logistics) in migrations 47-48. If you add a new unique column, follow this pattern.
- **Reconcile children in place by `Id`**: for any parent-with-child-list save (SO Lines, PO Items, Mill Units), match incoming children to existing rows by `Id` — `UPDATE` matches in place, `INSERT` new ones, soft-delete only rows genuinely absent from the submission. Never wipe-and-reinsert the whole list (it regenerates child `Id`s and orphans any FK pointing at them). See `SalesOrderRepository.ReconcileLinesAsync` for the reference implementation, and HANDOFF.md §5 for an ordering gotcha (removed rows must be soft-deleted *before* the update/insert loop when a filtered unique index covers the reordered column).

## Backend Services (Phase 1 Complete)

- **Email** — MailKit 4.9.0, Gmail App Password via SMTP StartTLS on port 587. SMTP credentials stored in `system.CompanyConfig` (Id=1). Sending attaches a PDF of the SO/PO.
- **PDF generation** — QuestPDF 2024.12.0 (Community license). `SalesOrderPdfService` and `PurchaseOrderPdfService` in `Backend/Monit.API/Services/`.
- **PO rate logic** — PO stores `Rate` as the final (post-discount) rate; base rate back-calculated as `Rate / (1 - Discount/100)` for display in emails and PDF.
- **SO rate logic** — SO stores `Rate` as the base (pre-discount) rate; `Discount` is a ₹ amount; `FinalPrice = Rate - Discount`.
- **Company Config** — `system.CompanyConfig`, one row per tenant (Id=1 Sales Agency, Id=2 Associates). MERGE SQL uses "null = keep existing, empty string = clear" pattern so saving one section (e.g. SMTP) never overwrites another section (e.g. Insurance).
- **EmailSentAt** — both SO and PO tables have `EmailSentAt` column. Frontend `emailSentCache.ts` persists sent IDs in localStorage so the "Mail Sent ✓" state is consistent across page navigations and the Approvals page.
