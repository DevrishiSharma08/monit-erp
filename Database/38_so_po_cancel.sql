-- ============================================================
-- FILE : 38_so_po_cancel.sql
-- DESC : Cancel action for Sales Orders & Purchase Orders — distinct
--        from Delete. Keeps the SO/PO number, row, and all its history
--        intact (so it stays visible + traceable in the grid, greyed
--        out) but flips Status = 'Cancelled' with a mandatory reason.
-- RUN  : Idempotent — safe to re-run. Run against BOTH tenant DBs
--        (MonitPaperDB and MonitAssociatesDB / testing DB).
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'CancelReason')
    ALTER TABLE sales.SalesOrders ADD CancelReason NVARCHAR(500) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'CancelledAt')
    ALTER TABLE sales.SalesOrders ADD CancelledAt DATETIME2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'CancelledBy')
    ALTER TABLE sales.SalesOrders ADD CancelledBy NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'CancelReason')
    ALTER TABLE procurement.PurchaseOrders ADD CancelReason NVARCHAR(500) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'CancelledAt')
    ALTER TABLE procurement.PurchaseOrders ADD CancelledAt DATETIME2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'CancelledBy')
    ALTER TABLE procurement.PurchaseOrders ADD CancelledBy NVARCHAR(100) NULL;
GO
-- ============================================================
-- FILE : 38_so_po_cancel.sql
-- DESC : Cancel action for Sales Orders & Purchase Orders — distinct
--        from Delete. Keeps the SO/PO number, row, and all its history
--        intact (so it stays visible + traceable in the grid, greyed
--        out) but flips Status = 'Cancelled' with a mandatory reason.
-- RUN  : Idempotent — safe to re-run. Run against BOTH tenant DBs
--        (MonitPaperDB and MonitAssociatesDB / testing DB).
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'CancelReason')
    ALTER TABLE sales.SalesOrders ADD CancelReason NVARCHAR(500) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'CancelledAt')
    ALTER TABLE sales.SalesOrders ADD CancelledAt DATETIME2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('sales.SalesOrders') AND name = 'CancelledBy')
    ALTER TABLE sales.SalesOrders ADD CancelledBy NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'CancelReason')
    ALTER TABLE procurement.PurchaseOrders ADD CancelReason NVARCHAR(500) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'CancelledAt')
    ALTER TABLE procurement.PurchaseOrders ADD CancelledAt DATETIME2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'CancelledBy')
    ALTER TABLE procurement.PurchaseOrders ADD CancelledBy NVARCHAR(100) NULL;
GO
