# HANDOFF — Read This First

**Last updated:** 2026-08-04, right before a laptop migration (the second one — see the "2026-07-14" material below for what was true at the FIRST migration; everything from §7 item 16 onward happened in the session between the two). This file exists so a brand-new Claude Code session (or a new developer) can get fully oriented in one read, without needing the prior chat history — which does NOT carry over to a new machine/session.

If you are Claude Code reading this at the start of a new session: also read `CLAUDE.md` (auto-loaded, shorter, more code-convention focused). This file is the deeper "what's the current state of the world and why" briefing.

---

## 0. What this project is

**Monit Paper Agency ERP** — internal admin panel for a paper-trading company in Indore (two legal entities / tenants: **Monit Paper Sales Agency** and **Monit Paper Associates**, sharing one codebase, separate databases). Covers the full paper trading lifecycle: procurement from mills, inventory receipt, sales orders, dispatch planning, delivery, and role/permission management.

**Status as of this handoff:** Phase 1 (procurement + sales order flow) is backend-integrated and in **client UAT (User Acceptance Testing)** — the client is actively using it and reporting bugs/feature requests in small batches. This is effectively a **live production system** for one client relationship; treat bug fixes with production care (the user who runs these sessions repeatedly stresses "system is live").

Phase 2 (deeper sales flow: Inquiry, Coverage, Pick Plan, In-Transit, Invoices) and Phase 3 (Dashboards, Reports, CRM) are built in code but **intentionally hidden** — commented out of `frontend/components/Sidebar.tsx`, not part of the current client-facing scope. Don't "helpfully" re-enable them.

---

## 1. Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Frontend tables | `@tanstack/react-table` wrapped in a custom `DataGrid` component |
| Frontend charts | Recharts |
| Frontend DnD | `@dnd-kit` |
| Backend | .NET 10 Web API (`TargetFramework=net10.0` in `Monit.API.csproj`) |
| Backend data access | **Dapper** (raw SQL, no EF Core, no migrations framework) |
| Database | SQL Server (MSSQL), two databases: `MonitPaperDB` (Company1) and `MonitAssociatesDB` (Company2) |
| Auth | JWT Bearer (access token) + HttpOnly refresh-token cookie |
| Password hashing | BCrypt.Net-Next |
| PDF | QuestPDF 2024.12 (Community license) |
| Email | MailKit 4.9.0, Gmail App Password, SMTP StartTLS port 587 |
| Export | ClosedXML (Excel), iTextSharp/QuestPDF (PDF), OpenXml (Word) |

---

## 2. Running it locally

```bash
# Frontend
cd frontend
npm install
npm run dev        # localhost:3000

# Backend
cd Backend/Monit.API
dotnet run         # https://localhost:7xxx (check console output for exact port)
```

Default login: `admin` / `Admin@123` (change on first login). Admin bypasses the whole permission system (see §6).

### Database setup — IMPORTANT, the numbering is messy

Run every `.sql` file in `Database/` in roughly ascending numeric order. **All scripts are idempotent** (`IF NOT EXISTS` guards, or safe-to-rerun `DROP`+`CREATE`) — safe to re-run any of them any number of times, on either DB. Current highest migration: **`48_filter_remaining_unique_constraints_on_isdeleted.sql`**.

New since the 2026-07-14 handoff (`39` through `48` — **all ten of these have already been run on BOTH live DBs**, confirmed during the session that wrote them):
- `39_mot_closed_ready_qty_fix.sql`, `40_mot_terminal_status_ready_qty_fix.sql`, `41_mot_dispatched_status_qty_fix.sql`, `43_mot_dispatched_ready_reconciliation.sql` — retroactive data fixes for the Mill Tracker Ready/Dispatched qty sync bugs (see §7 items 16-19).
- `42_po_backfill.sql` — PO Backfill feature (mirrors SO Backfill).
- `44_po_transit_insurance.sql` — adds `InsurancePolicyNo` to `procurement.PurchaseOrders` (PO never had this column at all; SO had it since `11_sales_order_backend.sql`).
- `45_fix_orphaned_mill_unit_addresses.sql`, `46_fix_orphaned_po_linked_so_lines.sql` — **one-off DATA repair scripts**, not schema changes. Re-running them is harmless (they only touch rows that are still actually broken) but they're not "part of every fresh DB setup" the way the others are — see §5's new "reconcile in place, don't wipe-and-reinsert" section for why these were needed.
- `47_filter_master_unique_constraints_on_isdeleted.sql`, `48_filter_remaining_unique_constraints_on_isdeleted.sql` — converts 31 plain `UNIQUE` constraints across the whole schema to filtered unique indexes (`WHERE IsDeleted = 0`). **Genuinely load-bearing, run these on any fresh DB.** See §5.

Quirks to know about, so you don't get confused hunting for a "missing" file:
- There are two files both prefixed `11_` (`11_migration_po_columns.sql`, `11_sales_order_backend.sql`) and two both prefixed `26_` (`26_tlp_loads.sql`, `26_company_details_and_user_both_access.sql`). Both in each pair need to run; the number just wasn't kept unique.
- A handful of files use a totally different `V00X__Description.sql` naming scheme (`V005__PurchaseOrderItems_WeightKg_Discount.sql`, `V006__CompanyConfig_Address_GstNumber_Users_BothCompaniesAccess.sql`, `V006__SalesOrderLines_Remarks.sql`, `V007__PurchaseOrders_MillUnitId.sql`) — these are real, needed migrations too, just numbered inconsistently from an earlier tooling attempt.
- `Database/_future/` = Phase 2/3 schema, **do not run now**.
- `Database/check_db_schema_diff.sql` and `Database/reset_monitpaperdb_for_handover.sql` are one-off utility scripts, not part of the migration chain.
- `Database/reset_local_testing_db_for_demo.sql` and `Database/seed_dummy_masters_for_demo.sql` are **local-dev-only** helpers (hard-locked to `MonitPaperDB_Testing`, will abort on any other DB name) — full wipe + placeholder ABC/PQR-named dummy masters, built for a client-demo prep session. **`seed_dummy_masters_for_demo.sql` and the reset script's bootstrap both write "Indus Paper ERP"-style branding into `system.CompanyConfig`** — a leftover from a same-session client-demo branding experiment (see §7 item ~24) that was fully reverted in actual source code, but if you ever re-run these two scripts locally, remember to re-apply the real "Monit Paper Sales Agency" / "Monit Paper Associates" names to `CompanyConfig` afterward, or just don't run them unless doing another local demo reset.
- `Database/test_po_mot_queries_directly.sql` — a diagnostic-only script (raw copies of the PO/MOT list SELECTs) used to isolate a SQL-vs-.NET bug live; not part of the migration chain, safe to ignore/delete.
- **Run every migration on BOTH `MonitPaperDB` and `MonitAssociatesDB`.** This has been forgotten before — always double check both tenant DBs got the latest script when handing off a new schema change.

---

## 3. Multi-tenant architecture — the thing to never break

Two companies, two databases, one running API process, one frontend build. Tenant is resolved from the JWT `company_id` claim → `DbConnectionFactory.CreateForCompanyAsync` picks `MonitPaperDB` or `MonitAssociatesDB`. A user can be granted access to both companies (there's a company-switcher in the UI).

**Any change touching auth, JWT claims, or DB connection resolution must be verified against BOTH companies before considering it done.** This has been the single most repeated caution across past sessions — the person running these sessions (Hindi/Hinglish speaking, refers to themselves informally, addresses the assistant as "bhai") is very concerned about this specific risk, more than almost anything else in this codebase.

---

## 4. The business flow (what the app actually does, in order)

```
Sales Order (SO)  ──►  Purchase Order (PO), raised "Against SO" or "For Stock"
                              │
                              ▼  (on PO Approve)
                       Mill Order Tracker (MOT)
                       tracks production/dispatch status per PO line
                              │
                              ▼  (when MOT line is Ready)
                       Truck Load Plan (TLP)
                       groups ready MOT lines onto a truck
                              │
                              ▼  (Enter Dispatch on the TLP)
                       Dispatch Receipt
                       records the truck actually left the mill w/ invoice
                              │
                              ▼  (Create GRN per invoice)
                       GRN (Goods Receipt Note)
                       goods arrive at godown OR go direct-to-client
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              Stock Lot            (DirectQty — no stock lot)
              (FIFO, per bin)            │
                    │                   │
                    └─────────┬─────────┘
                              ▼
                     Pending SO Closure KPI (on the Sales Order page)
                     user manually clicks "Create Challan"
                              │
                              ▼
                     Delivery Challan (Draft → Dispatched → Delivered)
                              │
                              ▼ (on Delivered, if all SO lines fully delivered)
                     SO auto-closes
```

**Active pages today** (ground truth = `frontend/components/Sidebar.tsx`, `NAV_ADMIN` array — check this file directly, it's the single source of truth for what's actually live vs Phase-2/3-hidden):

`/` (Dashboard) · `/orders` (Sales Order) · `/approvals` · `/purchase-orders` · `/mill-tracker` · `/truck-load-plan` · `/dispatch` · `/grn` · `/challan` (Delivery Challan) · `/stock-lots` · `/masters/*` (11 master pages) · `/settings/company`, `/settings/users`, `/settings/roles`.

**Explicitly hidden / not in current scope** (commented out in Sidebar, confirmed with the client during this session): `/inquiry`, `/coverage`, `/dispatch-queue` (a different, older page than `/dispatch` — don't confuse the two), `/pick-plan`, `/in-transit`, `/purchase-invoices`, `/sales-invoices`, all `/dashboard/*` variants except the root, all `/reports/*`. Some of these still read from `frontend/data/mockData.ts` and were never wired to the real API — that's fine, they're intentionally parked.

If `frontend/README.md`'s "Pages & Routes" table or "Still using mock data" section disagrees with the Sidebar file, **trust the Sidebar file** — the README has drifted out of date at least once already.

---

## 5. Key domain conventions (the ones that have caused real bugs)

### Weight vs. sheet-count — the recurring bug class
Sales Order lines can be entered by the user either as a **sheet count** or a **weight in kg**. There are TWO different, occasionally-disagreeing ways the app derives kg:
1. **SO form's own conversion** (`SalesOrderForm.tsx`): `weightKg = sheetCount × material.weightPerSheet`. This SILENTLY fails (leaves `weightKg` undefined) if the material master's `WeightPerSheet` field is blank/zero — and the SO submit code then does `orderedQty = weightKg ?? qty ?? 0`, which falls back to the RAW SHEET COUNT being stored in what's supposed to be a kg field.
2. **Independent recompute** (`frontend/lib/weight.ts` → `lineWeightKg()` / `calcWeightKg()`): `kg = gsm × (length/100 × width/100) × sheetCount / 1000`, needs no `weightPerSheet` master data at all.

Almost every on-screen list/grid in the frontend uses `lineWeightKg()` (method 2), so it displays correctly even when the stored `OrderedQty` is corrupted by method 1's silent failure. But anything that was reading the raw stored field directly (backend PDF generation, Delivery Challan repository) was showing the wrong (sheet-count) number as if it were kg. Two rounds of this bug have already been found and fixed this way:
- `Backend/Monit.API/Services/Sales/SalesOrderPdfService.cs` — PDF was printing raw `OrderedQty`.
- `Backend/Monit.API/Repositories/Inventory/DeliveryChallanRepository.cs` (`GetOpenSosAsync`, the SO-reopen-on-DC-delete check, and `AutoCreateDraftFromGrnAsync`) — same root cause, affected actual pick/dispatch quantities, not just display.

**The fix pattern**: never trust a stored "kg" field at face value if the line also has GSM + Size + a sheet-count field. Recompute independently. There's now a shared C# helper for this: **`Backend/Monit.API/Common/Helpers/WeightCalculator.cs`** — `WeightCalculator.LineWeightKg(storedQty, sheetQty, gsm, size)`. **Use this helper (or its frontend twin `lib/weight.ts`'s `lineWeightKg()`) any time you touch code that reads a SO line's quantity/weight field.** Don't assume any new backend query is safe just because an existing similar one looked fine — audit it.

Purchase Order items do NOT have this bug — they have a genuinely persisted, round-tripped `WeightKg` column (not silently dropped like SO's), and both frontend and backend already consistently do `weightKg > 0 ? weightKg : quantity`. If asked to "check everywhere for this bug," the last full audit (this session) found and fixed: PDF, Delivery Challan (3 spots), "Create PO from SO" total-weight column. It explicitly did NOT touch Coverage / Dispatch Queue / Purchase Invoices pages, because those are Phase-2, not in scope, and are mock-data-only anyway.

### PO / SO rate storage — opposite conventions, easy to mix up
- **PO**: `Rate` stored = **final, post-discount** rate (what the mill actually bills). The pre-discount "list" rate for display is back-calculated as `Rate / (1 - Discount/100)` (or `Rate + Discount` where Discount is a flat ₹/kg, check the specific call site — there are both patterns depending on whether Discount is a % or a flat amount in that context).
- **SO**: `Rate` stored = **base, pre-discount** rate. `Discount` = a flat ₹ amount. `FinalPrice = Rate - Discount`.

Getting these backwards has caused at least one real bug (GRN showing PO rate as 98 instead of 100 because someone tried to store the list rate directly instead of back-calculating it for display only).

### Computed columns
`inventory.StockLots.AvailableQty` is a SQL **computed column** (`CurrentQty - ReservedQty`). Never `UPDATE ... SET AvailableQty = ...` — it'll throw. Only write `CurrentQty`/`ReservedQty` and let the DB derive the rest. If you hit a similar error elsewhere, check `sys.computed_columns` before assuming it's a permissions issue.

### Dapper transaction anti-pattern
Don't nest a `tx.Rollback()` inside a `try` that's also wrapped in a `catch { tx.Rollback(); throw; }` — the second `Rollback()` call throws "SqlTransaction has completed" and masks whatever the real validation error was. Pick one rollback path.

### Delivery Challan — single manual flow (do not reintroduce auto-DC)
There used to be two competing ways a Delivery Challan could be created (auto-DC when a GRN had a direct-to-client portion, AND manual creation from a "Pending SO Closure" KPI). The client explicitly chose **Option 2: manual only** — auto-DC-from-GRN was removed from the GRN creation path (though the method `AutoCreateDraftFromGrnAsync` still exists on the repo, just not wired in). If a future ask sounds like "auto-create X when Y happens downstream," check whether it's re-introducing this exact anti-pattern before building it — the client got confused by double-DC creation once already.

### Soft-delete + plain UNIQUE constraint = a landmine (fixed everywhere, but watch for new occurrences)
Every table in this schema is soft-delete only (`IsDeleted` bit, never a hard `DELETE`). Several `UNIQUE` constraints were defined as **plain** constraints (`Code`, `SONumber`, `Username`, etc.) instead of filtered indexes — meaning once a row was soft-deleted, its Code/Number/Name permanently occupied the unique key and could **never be reused**, even though the row was invisible everywhere in the UI. Live-reported symptom: a user created a Material, deleted it, then tried to re-add the exact same code (or the SO/PO free-text auto-provisioner tried to, on their behalf) — 500 `UNIQUE KEY constraint` violation, generic "unexpected error" on the frontend (the SQL exception isn't a `ValidationException`, so `ExceptionMiddleware`'s catch-all swallows the real reason).

Fixed for **31 constraints across every schema** (`auth`, `sales`, `procurement`, `inventory`, `logistics`, `masters`) in migrations `47`/`48` — each plain `UNIQUE` constraint was dropped and replaced with `CREATE UNIQUE INDEX ... WHERE IsDeleted = 0`. **Any NEW table/column you add with a business-meaningful unique value (Code, Number, Name, Username, a composite line-number key, etc.) must use a filtered unique index from day one**, not a plain constraint — this whole bug class only exists because the original schema didn't.

### Reconcile children in-place by Id — never wipe-and-reinsert a child collection
`SalesOrderLines`, `PurchaseOrderItems`, and `MillUnits` are all "parent has a list of children, whole list gets replaced on parent save" shapes. The ORIGINAL pattern for all three was: soft-delete every existing child, then insert the submitted list fresh — which means **every save regenerates every child's Id**, even for a child the user didn't touch. Anything holding a plain FK to that child's Id (no `IsDeleted` filter on the join, since normal reads shouldn't need one) gets silently orphaned: `procurement.PurchaseOrderItems.LinkedSOLineId`, `procurement.MillTrackers.POItemId`, and any historical PO pointing at a `MillUnits.Id` all went stale on the very next unrelated edit of their parent. Concretely this caused: (a) editing a Mill's phone number silently orphaned the mill-unit address/GST that every historical PO/tracker was reading (fixed via `MillRepository.ReconcileUnits`, retroactive repair `45`); (b) editing an SO's remarks silently orphaned the PO's link back to that SO line, which broke the brand-new Order-Placed edit-lock guard (see below) since it resolves via that FK — fixed via `SalesOrderRepository.ReconcileLinesAsync`, retroactive repair `46`.

**The fix pattern, now used by `MillRepository.ReconcileUnits` and `SalesOrderRepository.ReconcileLinesAsync`**: the child DTO carries its DB `Id` (nullable) when it's an existing row; the repository matches incoming rows against currently-active DB rows by that Id — `UPDATE ... WHERE Id=@Id` for a match (Id never changes), plain `INSERT` for a new row (no Id / Id not found), and only soft-deletes DB rows whose Id wasn't present in the incoming submission at all. `PurchaseOrderItems` (PO's own items, as opposed to `MillUnits` and `SalesOrderLines`) still uses the OLD wipe-and-reinsert pattern as of this handoff — it happens to be safe there ONLY because a separate mechanism (`MillTrackerRepository.SyncForPoUpdateAsync`) explicitly re-points `MillTrackers.POItemId` to the freshly-inserted item's new Id every time a PO is saved. If you ever touch PO item persistence, know that this safety net exists and don't remove it without replacing it with real Id-preserving reconciliation.

**Sharp edge found the hard way — deletion must happen BEFORE reassignment, not after**: `sales.SalesOrderLines` (and `PurchaseOrderItems`) has a filtered-unique index on `(ParentId, LineNumber) WHERE IsDeleted = 0`. The frontend renumbers all *remaining* lines sequentially after a removal (`removeLine()` in both `SalesOrderForm.tsx` / `PurchaseOrderForm.tsx`: `list.forEach((l, i) => l.lineNumber = i + 1)`). If you reconcile by looping "update kept rows, insert new rows, THEN soft-delete removed rows" (the first version of `ReconcileLinesAsync` did exactly this), a kept row can get UPDATEd into a `LineNumber` slot that's *still actively occupied* by the not-yet-deleted removed row — live 500 error, "remove an item + add an item in the same edit" (client-reported on `MPSA/26-27/545`). **Always compute which rows are being removed up front and soft-delete them in one batch BEFORE the update/insert loop runs**, so no LineNumber slot is ever double-occupied mid-transaction. Verified via direct API round-trips (single remove+add, multi remove+multi add, and full wholesale replacement) before this was called safe.

### Single source of truth — no dual entry points for the same physical event (recurring client principle)
The client has rejected "the same real-world event can be recorded two different ways" **three separate times** now, always for the same underlying reason (two paths silently double-count or disagree): (1) Mill Tracker's old "Add Batch" manual entry, removed in favor of the real Dispatch → TLP → GRN flow (§7 item 8, pre-2026-07-14); (2) manually setting Mill Tracker status to "Dispatched"/"Partial Dispatched" (via Update Status modal OR the Excel bulk-upload) instead of it being derived automatically from a real Dispatch Receipt — caused a live double-counted dispatch qty (40,069 shown instead of 20,069); fixed by removing "Dispatched" as a selectable status everywhere in the manual-entry UI and hard-rejecting it server-side (`MillTrackerRepository.UpdateStatusAsync` throws `InvalidOperationException` unless the tracker is ALREADY at that terminal status — see §7 item ~20-22 for the exact guard shape, it deliberately allows a no-op re-save of an already-Dispatched row so bulk-Excel re-uploads of untouched rows don't break). **If a new feature request sounds like "auto-set X when Y happens, but also let the user set X manually somewhere else,"** stop and ask which one is the single source of truth before building — this has bitten the client in production multiple times.

### Order-Placed edit lock — Material/GSM/Size/Quantity on SO & PO lines
As of this session, SO lines and PO items ARE editable (Material/GSM/Size were previously read-only/locked on PO — that lock was explicitly removed; see the now-updated §7 "Parked" note below), but **only while the linked Mill Tracker is still at status "Order Placed."** Once a mill has reported any progress (Partial Ready / Ready / Dispatched / Delayed / Cancelled / Closed) against a line's original spec, changing Material/GSM/Size/Quantity on that line is rejected server-side with a `ValidationException` naming the offending line + its current status. Implementation:
- `PurchaseOrderService.GuardMaterialSpecChangeAsync` — direct: PO item → `MillTrackers.POItemId`.
- `SalesOrderService.GuardMaterialSpecChangeAsync` — indirect: SO line → `PurchaseOrderItems.LinkedSOLineId` → `MillTrackers.POItemId` (this is the exact FK chain that needed the `ReconcileLinesAsync` fix above to stay valid).
- Both guards live in `Common/Helpers` via `IMillTrackerRepository.GetBlockingStatusesForPoItemsAsync` / `GetBlockingStatusesForSoLinesAsync` (batched, not N+1).
- Frontend: the error surfaces as a centered `ToastContext` toast (see the new toast behavior note below) — the guard itself has no frontend-side pre-check, it's a save-time rejection.

### Toast behavior (recently hardened)
`ToastContext.tsx`'s toast container is `z-[10000]` — deliberately **above** every `Modal`/`PortalModal`/`ConfirmDialog` (`z-[9999]`), so an error fired while an Edit modal is open is never hidden behind it (was a real client complaint — user couldn't tell why a save silently "didn't work"). **Error/warning toasts no longer auto-dismiss** — they stay until the user clicks the X; success/info still auto-dismiss (3.5s). Also: **always catch save-flow errors locally and call `useToast()`'s `error()` yourself**, don't rely on letting the promise go truly unhandled — an unhandled rejection in a Next.js dev-mode event handler also trips Next.js's own full-screen dev error overlay (looks like the app crashed) on top of whatever the global `ToastContext` `unhandledrejection` listener shows. `SalesOrderForm.tsx` and `PurchaseOrderForm.tsx`'s save handlers both do this correctly now — use them as the reference pattern for any new form's save flow.

### Permission-gated everything, not role-name-gated
See §6.

---

## 6. Permission system

The client wants: **any user with the right permission can do the action, regardless of their named role; if they lack the permission, they get a friendly toast, not a crash.** This was implemented via:

- `Backend/Monit.API/Common/Middleware/RequirePermAttribute.cs` — an `IAuthorizationFilter` used as `[RequirePerm("so.write")]` etc. on controller actions. Checks a `perm` claim on the JWT; **Admin role always bypasses** (`user.IsInRole("Admin")` short-circuits). On failure, returns a 403 with a friendly `ApiResponse.Fail(...)` body (this mattered — a bare 403 with no body was surfacing as an ugly Next.js dev-overlay crash instead of a toast).
- Permission catalog lives in `Backend/Monit.API/Services/Auth/RoleService.cs` (`AvailablePermissions`), grouped like: `so.{read,write,delete,print}`, `po.{read,write,delete,print}`, `mill.{...}`, `logistics.{...}`, `grn.{...}`, `stock.{...}`, `masters.{...}`, `approvals.{read,write}`, `company.{read,write}`, `users.{read,write,delete}`, `roles.{read,write,delete}`, `dashboard.{read,write}`.
- Applied to essentially every write/delete controller action across Masters, Sales Orders, Purchase Orders, Mill Tracker, GRN, Dispatch Receipts, Delivery Challans, Truck Load Plan, Stock Lots, Company Config. `UsersController` / `RolesController` are intentionally still `[Authorize(Roles = "Admin")]` only (kept admin-exclusive on purpose — user/role management is treated as more sensitive than the rest).
- Frontend: `Sidebar.tsx` items carry a `perm` field and are filtered against the logged-in user's permission set. When an action is denied, the global `unhandledrejection` listener in `context/ToastContext.tsx` catches the resulting `ApiError` and shows a centered toast instead of letting it crash.

If you're asked to gate a NEW endpoint by permission, follow the exact pattern above rather than inventing a new one — check an existing controller like `SalesOrdersController.cs` for the shape.

---

## 7. Recent feature history (roughly chronological, most recent last)

This list exists because a lot of work has piled up **uncommitted** in the working tree (see §9 — this matters a lot for the laptop migration). Treat this as "what's already built and why," not a to-do list.

1. **Multi-tenant support** — two DBs, `company_id` JWT claim, company switcher.
2. **Role-based access control** (superseded by the permission system below, but the underlying Role/User/Team tables are still there).
3. **Email + PDF integration** — MailKit + QuestPDF, `EmailSentAt` tracking, `lib/emailSentCache.ts` for cross-page "Mail Sent ✓" consistency. See §5 for the rate-display conventions this touches.
4. **Item-wise Mill Tracker + TLP load types**, weight(kg)-flow standardization across MOT/TLP.
5. **Delivery Challan single-flow finalization** (Option 2 — see §5).
6. **GRN pending-list reworked to group by invoice number**, not by TLP plan.
7. **Permission system rollout** (§6) — replaced `[Authorize(Roles=...)]` with `[RequirePerm(...)]` across ~23 controllers, added the friendly-403 body, fixed the resulting raw-error-overlay bugs on the frontend (SO/PO delete, toast repositioning to viewport-center).
8. **Mill Tracker "Close Tracker" feature** — short-delivery finalization (`IsClosed`/`ClosedAt`/`ClosedBy`/`CloseReason` columns, migration `37_mill_tracker_close.sql`). Also removed the old "Add Batch" manual-entry flow from Mill Tracker entirely (client asked for this — DispatchReceipts via the proper TLP→Dispatch flow is now the single source of truth for partial deliveries, not a second parallel entry point).
9. **Fixed a real data-integrity bug**: `DispatchReceiptRepository.CreateAsync` never updated the source Mill Tracker's `DispatchedQty` — TLP → Dispatch → GRN flow left the tracker showing 0 dispatched even when goods were already in Pending GRN. Fixed by syncing the tracker inside the same transaction as the dispatch receipt item insert.
10. **SO/PO PDF weight-in-kg bug fix** (see §5) — added `WeightCalculator.cs`, applied to `SalesOrderPdfService.cs`. Also merged the PDF's separate Length/Width columns into one "Size" column to match the PO PDF layout.
11. **Delivery Challan weight-in-kg audit and fix** (see §5) — `DeliveryChallanRepository.cs`'s `GetOpenSosAsync`, SO-reopen-on-delete check, and `AutoCreateDraftFromGrnAsync` all recompute weight via `WeightCalculator` now instead of trusting the raw stored quantity.
12. **GRN "Create GRN" packing default changed** from Sheets to **Bundle** (`frontend/app/grn/page.tsx`, `emptySheetRow()`).
13. **SO/PO Cancel feature** (distinct from Delete) — 3-dot menu → "Cancel Order" with a mandatory reason. Keeps the SO/PO number and full history intact (row stays visible, greyed out via a new generic `dimRow` prop on `DataGrid`), sets `Status = 'Cancelled'`. Migration `38_so_po_cancel.sql` (columns `CancelReason`/`CancelledAt`/`CancelledBy` on both `sales.SalesOrders` and `procurement.PurchaseOrders`). New endpoints `PATCH .../{id}/cancel` on both `SalesOrdersController` and `PurchaseOrdersController`, gated by the same `so.delete`/`po.delete` permission as Delete (not a separate permission — flag to the client if they want finer-grained control later).
14. **3-dot menu flip-up-when-near-bottom fix**, applied to Mill Tracker (earlier), Sales Order, and Purchase Order grids — the menu was clipping off-screen for the last row(s); now measures available space and opens upward when needed.
15. **Dispatch & GRN pages now default to "Pending" view on page load** (matching the pattern already used on Truck Load Plan), instead of defaulting to the "already created" grid. KPI cards for the other statuses (Pending GRN / GRN Done / Total on Dispatch; Draft / QC Pending / Approved / Stock Updated / Discrepancy on GRN) are now clickable — clicking one leaves the Pending view and filters the created-records grid by that status.

---

**Everything below happened in the session between the 2026-07-14 and 2026-08-04 handoffs — a very long, dense, mostly live-client-driven session. Numbering continues from above.**

16. **Mill Order Tracker "Ready" qty stayed stale after Close/Dispatch** (multiple rounds) — fixed in `MillTrackerRepository.CloseAsync` (now zeroes `ReadyQty`) and `DispatchReceiptRepository.CreateAsync` (now decrements Ready / increments Dispatched in the same transaction). Retroactive data fixes: migrations `39`, `40`, `41`.
17. **MOT Excel export ignoring the Active/Closed/All tab filter** — `exportExcel()` wasn't threading the grid's `closedView` filter through to the backend query; fixed.
18. **Mill Tracker search endpoint 500 crash** (`mil.Name` unbound multi-part identifier) — found live via direct API testing, one-line missing `JOIN masters.Mills mil` in `GetAllAsync`'s `countSql`. Bonus find, not what was being tested at the time.
19. **Truck Load Plan "planned vs remaining" quantity bug** — splitting one Mill Tracker line's Ready qty across two trucks showed the full original Ready qty on the SECOND truck's planning screen instead of what was left after the first truck's plan. Root cause was a premature `setReadyTrackers` filter that removed a partially-planned row from the list entirely instead of showing its remaining qty. Fixed with `TrackerEx`/`plannedElsewhereByTracker`/`availableToPlanQty` client-side computation. Retroactive reconciliation: migration `43`.
20. **PO Backfill** (`42_po_backfill.sql`) — exact mirror of the existing SO Backfill feature (historical/pre-system order entry with a user-supplied number, skips the auto-sequence).
21. **Item Master ("Add Item") remembers last-used Mill/Quality/Item Type/GSM**, and Mill/Quality became a proper searchable `Combobox` (was a plain `<select>`). Same searchable-`Combobox` fix later applied to `PurchaseOrderForm.tsx`'s Mill/Unit picker, and — much later in the session — to the **Item Code field on both `SalesOrderForm.tsx` and `PurchaseOrderForm.tsx`** (was a native `<input list>`/`<datalist>` combo that got permanently "stuck" showing only the exact-matched option until the field was cleared completely; `Combobox` doesn't have that bug). **`Combobox` requires a separate "currently typing" text state distinct from the confirmed value** — binding its `inputValue` directly to the confirmed selection makes typing collapse to blank on every keystroke; this exact mistake has now been made and fixed 4 times across different forms in this codebase, check `PurchaseOrderForm.tsx`'s `millUnitQuery`/`itemCodeQuery` state for the reference pattern before adding a new `Combobox` usage.
22. **Live double-counted Mill Tracker dispatch qty** (PO-7, N.R Agrawal, Associates tenant: 40,069 shown instead of the real 20,069) — root-caused via screenshots only (no live DB access at the time) as the dual-entry-point bug described in §5 above. Fixed old data via migration `43`; then, per explicit client decision, **removed "Dispatched"/"Partial Dispatched" as a manually-settable status everywhere** (Update Status modal dropdown, legacy CSV bulk-import template, Excel export's dropdown-validation list) and hard-rejected it server-side in `MillTrackerRepository.UpdateStatusAsync` — with the important refinement (found from a FOLLOW-UP bug: the guard originally also blocked no-op re-saves of an ALREADY-dispatched row, breaking Excel re-uploads that only touched Remarks/ExpectedDelivery on such rows) that the guard only fires on an actual transition INTO Dispatched, not on preserving an existing terminal status.
23. **MOT Excel bulk-import "untouched rows shouldn't change" fix** — `BulkImportAsync`/`BulkImportExcelAsync` now diff each incoming row against the tracker's current DB values field-by-field and skip the `UpdateStatusAsync` call entirely (counted as a new `Unchanged` result field) when nothing actually differs, instead of blindly re-saving every row in the file (which was stamping a fresh `LastUpdate`/history entry, and could even auto-roll an untouched-but-nonzero-Ready row's status forward, on every single upload).
24. **Temporary "Indus Paper ERP" client-demo rebrand, then fully reverted** — for a same-day new-client demo, every hardcoded "Monit Paper Agency"/"Monit Paper Associates" string across the frontend + backend fallback defaults was swapped to "Indus Paper ERP" / "Indus Paper ERP - Associates", the local test DB was wiped (`reset_local_testing_db_for_demo.sql`) and reseeded with placeholder ABC/PQR-named masters (`seed_dummy_masters_for_demo.sql`), and the local DB's `CompanyConfig` was rebranded too. **All of this was reverted back to real Monit branding in source code** once the demo need passed (grep the repo for "Indus" to confirm — should be zero hits outside the two demo SQL scripts' seed data). The live/production databases were never touched by any of this (branding is a frontend/appsettings-only concern; the live DB's `CompanyConfig` always had the real values).
25. **SO Edit form showing wrong/blank Weight for weight-only-entered lines** — `SalesOrderForm.tsx`'s edit-mode line init trusted a raw `weightKg` field the backend never actually populates for SO lines (SO's `Quantity` column is dual-purpose — sheets OR kg — with no separate weight column, unlike PO which has a real `WeightKg` column). Fixed by using the existing `lineWeightKg()` fallback-chain helper (same one View/PDF already used) instead of the raw field.
26. **Local dev CORS 405/blocked when the frontend dev server picks a non-standard port** (e.g. 3002 because 3000/3001 were busy) — added `http://localhost:3002` to `Cors:AllowedOrigins`, but **scoped the fix to `appsettings.Development.json` only**, never touching the shared `appsettings.json` (also read by production) or `appsettings.Production.json`.
27. **PO "Billed To" showing the WRONG tenant's company name/GST** on the Associates tenant, and Transit Insurance always blank on PO — two separate bugs found from the same client screenshot. (a) `PurchaseOrderService`/`SalesOrderService` were calling `companyCfgSvc.GetAsync(1)` — **hardcoded to Company 1** regardless of which tenant the logged-in user's JWT actually belonged to. Fixed via a new `HttpContextExtensions.GetCompanyId()` reading the `company_id` JWT claim (same claim `DbConnectionFactory` already uses). (b) Transit Insurance was never wired into PO at all (`InsurancePolicyNo` didn't exist on `procurement.PurchaseOrders`) — added end-to-end (migration `44`, entity/DTO/repo/PDF/form), mirroring the field SO already had.
28. **PO PDF/print polish**: "Order Id" row now hides entirely instead of printing "Order Id : —" when the mill's SO number wasn't captured; dates now print `dd/MM/yy` instead of raw ISO (fixed in both PO and SO PDF services); the 3-dot menu's "Print" action (and the View modal's own Print button) now fetch and print the **actual generated PDF** (via a shared `printPdfBlob()` hidden-iframe helper in `frontend/lib/printPdf.ts`) instead of maintaining a separately-styled HTML print view that had drifted out of sync with the real PDF. SO didn't have a Print action at all before this — added, matching PO.
29. **Mill Unit address/GST showing the WRONG unit's data** (client-reported: a PO raised against ITC's Bhadrachalam unit printed OMNI unit's street address) — `PurchaseOrderRepository`'s / `MillTrackerRepository`'s SELECTs fell back to "any other unit under this mill with a non-null address" whenever the PICKED unit's own address happened to be blank, instead of only falling back for POs that never picked a unit at all. Fixed to check `po.MillUnitId IS NOT NULL` before ever considering a cross-unit fallback. See §5's "reconcile in place" section for the RELATED (but distinct) `MillRepository` bug this led to discovering.
30. **31 soft-delete tables had plain (non-filtered) UNIQUE constraints** — see §5, migrations `47`/`48`. Found while root-causing a live "can't recreate a deleted Material" 500 error.
31. **SO/PO line item Material/GSM/Size/Quantity edit-lock** (Order-Placed guard) + **PO's GSM/Size fields unlocked** (were `readOnly`, forcing the whole composite Item Code to be retyped to fix just the GSM) — see §5. This directly supersedes the OLD "parked" note below about editing material at any lifecycle point; that investigation is now implemented (with a safety guard), not just explained.
32. **Delivery Challan "Pending SO Closure" list now shows which SOs are actually ready** — previously every open SO listed identically regardless of whether any stock/GRN was actually available to pick, so the user had to open each one via "Create Challan" to find out. `DeliveryChallanRepository.GetOpenSosAsync` now computes `HasAvailableStock` per SO in one batched query (same stock-lot + Direct-GRN check the Create-Challan modal already did per-line, just aggregated) and sorts ready-first; the frontend shows a green "Ready to deliver" vs grey "No stock/GRN yet" badge per row.

### Parked / explicitly deferred (do NOT implement without re-confirming with the client)

- **SO/PO auto-renumbering on delete** — client asked for this twice. First time, was talked out of full renumbering (GST/audit-trail risk of changing an already-issued document's number). Second time, came back with a narrower ask (cascade-renumber to close gaps, but only allowed when the deleted SO has no PO yet) — but when asked to clarify what happens when a CASCADED (not the deleted) SO/PO already has a PO/email out against it, the client said: **stop here, will discuss with the actual end-client first, do not implement, keep current code as-is.** This is genuinely paused, not forgotten — don't pick it back up without that conversation happening. Still paused as of this handoff.
- **Internal-vs-external numbering separation** — a related, never-resolved side discussion (3 options were presented: A. reuse the grid's existing `#` row-index column, zero code; B. add a DB `InternalSeq` column, ~1 day; C. full dual-namespace split, over-engineered). No decision made.
- **~15 Masters pages still show inline error banners instead of toast notifications** (only `masters/customers/page.tsx` was converted so far). Client said "decide later," not urgent.

---

## 8. Deployment / publish notes

- `Backend/Monit.API/appsettings.json` (source) was synced to match what's actually deployed in production (`Jwt.Secret`, `ConnectionStrings` for both companies) so future `dotnet publish` runs carry the right config forward. `appsettings.Development.json` overrides `ConnectionStrings` back to a local testing DB (`DEVRISHI\INDUS\MonitPaperDB_Testing` at one point — may have changed, check the file) when running in the Development environment, so local dev work doesn't touch production data.
- **Lesson already learned once**: before handing a `publish/` folder to the server team, always check the `.dll` timestamp against the newest source file timestamp. A stale publish was almost shipped once (source had changed since the last `dotnet publish`, but nobody had re-run it). Always `dotnet publish -c Release -o publish` fresh and spot-check the output timestamp before saying "this is ready to ship."
- Production reads `ConnectionStrings__Company1` / `ConnectionStrings__Company2` from environment variables when `ASPNETCORE_ENVIRONMENT=Production`.

---

## 9. About the uncommitted working tree — READ BEFORE ZIPPING

At the time of this handoff (second migration, 2026-08-04), `git status` shows **176 modified/new files with nothing committed** since commit `a987bc0` ("feat: SO remarks display, approval-gated flow, status terminology unification") — the same base commit as the FIRST handoff; nothing has been committed across either session. This uncommitted diff includes everything in §7 above (items 1-32), spanning both the pre-2026-07-14 work and the entire session since. New `Database/*.sql` files (`39` through `48`, plus the local-only demo/diagnostic scripts) are untracked and must be included in the zip explicitly if your zip tool only follows `git ls-files`.

**This means: if you move to a new machine by re-cloning from the git remote, you will lose all of this work.** The safe move is to **zip the actual working directory** (including the `.git` folder, so history is preserved too) rather than doing a fresh `git clone`. `node_modules/`, `bin/`, `obj/`, and `.next/` can be excluded from the zip (they regenerate on `npm install` / `dotnet build`) — everything else should go in, especially the uncommitted source changes.

If at some point you'd rather commit this pile of work before zipping (recommended, but only if explicitly asked for — don't do it unprompted), review the diff first since it spans a long, dense stretch of client-driven fixes; a single giant commit message won't be very useful for future `git blame` archaeology, so consider whether the user wants it split up.

---

## 10. Other docs in this repo, and how much to trust each one

| File | What it is | Trust level |
|---|---|---|
| `CLAUDE.md` | Auto-loaded project instructions for Claude Code. Kept reasonably current. | High — but cross-check against actual code for anything specific. |
| `HANDOFF.md` (this file) | Deep current-state briefing, written for a fresh session / new machine. | High as of its "Last updated" date at the top — but it's a snapshot, not live; verify anything load-bearing against the code before acting. |
| `BACKEND_ARCHITECTURE.md` | Original architecture reference doc, written early in the project. DB schema section predates many later migrations. | Medium — good for the original design rationale (schemas, entity base class, API envelope conventions); **do not** trust its DB schema section over the actual `Database/*.sql` files or `sys.columns`. |
| `BACKEND_REQUIREMENTS.md` | Original PRE-BUILD requirements/planning doc (endpoint paths like `/api/sales-orders` without `/v1/`, table designs like a separate `Challans`/`ChallanItems` schema that don't match what was actually built as `inventory.DeliveryChallans`). | Low for "how does it actually work today" — useful only for original business-rule rationale. The actual controllers + `Database/*.sql` are the source of truth for the as-built API/schema. |
| `README.md` (root) | DB setup / run-order instructions. | Medium — accurate for files `00`-`09`, doesn't mention the later migrations up to 38 (see §2 of this file for the real full list). |
| `frontend/README.md` | Frontend overview, routes, project structure. | Low-medium — the routes table and "still using mock data" section have drifted (e.g. lists `/dispatch-queue` as active when it's actually hidden; doesn't mention `/dispatch` which is the real active page; doesn't mention the permission system). Trust `Sidebar.tsx` over this file for routes. |
| `SRS/SRS_Monit_Paper_Agency.md` | Formal, versioned (v1.2) client-facing Software Requirements Spec. | Not touched by this handoff pass — it's a formal deliverable document, not an internal dev doc; treat edits to it as a separate, deliberate task if ever asked. |

Everything above except the SRS was refreshed alongside this handoff file — check each one's own "last verified" note if present.
