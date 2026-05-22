# MonitPaperDB — Database Setup

## Run Order (always in this sequence)

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

## Default Login
- **Username:** admin
- **Password:** Admin@123 ← change on first login

## Notes
- All scripts are idempotent (`IF NOT EXISTS` checks) — safe to re-run
- `_future/` folder contains Phase 2/3 scripts — do NOT run now
- All tables have soft-delete (`IsDeleted`, `DeletedAt`, `DeletedBy`)
- Number generation: use stored proc `system.usp_GetNextNumber`
