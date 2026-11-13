# MonitPaperDB — Database Setup

**See [HANDOFF.md](HANDOFF.md) §2 for the fuller picture** (this file covers the original `00`-`09` bootstrap sequence only — many more migrations have been added since, up to `38_so_po_cancel.sql` as of 2026-07-14).

## Run Order (base sequence — `00` through `09`)

```
00_schemas.sql            CREATE SCHEMA for all 7 schemas
01_system_tables.sql      NumberSequences, AuditLogs, Notifications
02_auth_tables.sql        Roles, Users, Teams, TeamMembers
03_masters_tables.sql     Mills, Materials, Customers, Salesmen,
                          Warehouses, Transporters, Sizes, Rates, etc.
04_sales_tables.sql       Inquiries, SalesOrders, SalesOrderLines
05_procurement_tables.sql PurchaseOrders, MillTrackers, History
06_inventory_tables.sql   GRNs, StockLots, Allocations, BinLocations
07_logistics_tables.sql   PickPlans, TLPs, Challans, InTransit
08_indexes.sql            All performance indexes
09_seed_data.sql          Number sequences + default roles + admin user
```

## After that — run everything else in `Database/`, in ascending order

Files `10_*.sql` through `38_*.sql`, plus a few inconsistently-numbered `V00X__*.sql` files (`V005__PurchaseOrderItems_WeightKg_Discount.sql`, `V006__CompanyConfig_Address_GstNumber_Users_BothCompaniesAccess.sql`, `V006__SalesOrderLines_Remarks.sql`, `V007__PurchaseOrders_MillUnitId.sql`) — these are real, needed migrations from an earlier tooling attempt, just numbered differently. Two file-number collisions exist (`11_migration_po_columns.sql` + `11_sales_order_backend.sql`; `26_tlp_loads.sql` + `26_company_details_and_user_both_access.sql`) — run both files in each pair. `check_db_schema_diff.sql` and `reset_monitpaperdb_for_handover.sql` are one-off utility scripts, not part of the migration chain.

**Run every migration on BOTH tenant databases** (`MonitPaperDB` and `MonitAssociatesDB`) — easy to forget one.

## Default Login
- **Username:** admin
- **Password:** Admin@123 ← change on first login

## Notes
- All scripts are idempotent (`IF NOT EXISTS` checks) — safe to re-run
- `_future/` folder contains Phase 2/3 scripts — do NOT run now
- All tables have soft-delete (`IsDeleted`, `DeletedAt`, `DeletedBy`)
- Number generation: `system.NumberSequences` table updated with `UPDLOCK` via `SalesOrderRepository.GenerateSONumberAsync` — no stored procedure needed
- Passwords are stored as BCrypt hashes (`$2...` prefix). Legacy plaintext passwords are auto-upgraded on first login.
- Auth users table column is `Password` (not `PasswordHash`)
