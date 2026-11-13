-- ============================================================================
-- FILE : 30_delivery_challan.sql
-- DESC : Closes the outward (sales-side) loop:
--          - inventory.DeliveryChallans       — header per shipment to customer
--          - inventory.DeliveryChallanItems   — lines linking SO lines to either
--                                                a StockLot (from-stock sale) or
--                                                a GRN (direct-from-mill sale)
--          - sales.SalesOrderLines.DeliveredQty — running total per line so SO
--                                                  can auto-close when full.
--          - DC number sequence in system.NumberSequences.
--
-- RUN  : Anytime after 29_dispatch_receipt_and_grn_packings.sql.
-- Idempotent — safe to re-run.
-- ============================================================================

PRINT '── Migration 30: Delivery Challan + SO closure tracking ─────';
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 1. inventory.DeliveryChallans  (header — one per shipment to customer)
-- ─────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables
               WHERE object_id = OBJECT_ID('inventory.DeliveryChallans'))
BEGIN
    CREATE TABLE inventory.DeliveryChallans (
        Id                  INT             IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ChallanNumber       NVARCHAR(20)    NOT NULL,
        ChallanDate         DATE            NOT NULL,
        SalesOrderId        INT             NOT NULL,
        CustomerId          INT             NOT NULL,
        CustomerName        NVARCHAR(200)   NULL,           -- denormalised for display
        -- Sourcing snapshot
        DeliveryMode        NVARCHAR(30)    NOT NULL DEFAULT 'FromStock',
            -- FromStock  → all items pulled from inventory.StockLots
            -- DirectFromMill → all items shipped direct from a GRN
            -- Mixed      → both sources used in same challan
        DispatchedFrom      NVARCHAR(200)   NULL,           -- warehouse name OR mill name
        -- Transport
        VehicleNumber       NVARCHAR(20)    NULL,
        TransporterName     NVARCHAR(200)   NULL,
        LRNumber            NVARCHAR(50)    NULL,
        DriverName          NVARCHAR(100)   NULL,
        DriverPhone         NVARCHAR(20)    NULL,
        FreightAmount       DECIMAL(18,2)   NULL,
        DeliveryAddress     NVARCHAR(500)   NULL,
        EWayBillNumber      NVARCHAR(50)    NULL,
        Remarks             NVARCHAR(500)   NULL,
        -- Workflow status
        Status              NVARCHAR(50)    NOT NULL DEFAULT 'Draft',
            -- Draft       → being prepared
            -- Dispatched  → vehicle left warehouse / mill
            -- Delivered   → customer signed off
            -- Cancelled   → reverted (stock returned to lot)

        CreatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy           NVARCHAR(100)   NOT NULL,
        UpdatedAt           DATETIME2       NULL,
        UpdatedBy           NVARCHAR(100)   NULL,
        IsDeleted           BIT             NOT NULL DEFAULT 0,
        DeletedAt           DATETIME2       NULL,
        DeletedBy           NVARCHAR(100)   NULL,

        CONSTRAINT UQ_DeliveryChallans_Number UNIQUE (ChallanNumber),
        CONSTRAINT FK_DeliveryChallans_SO    FOREIGN KEY (SalesOrderId)
            REFERENCES sales.SalesOrders(Id),
        CONSTRAINT FK_DeliveryChallans_Cust  FOREIGN KEY (CustomerId)
            REFERENCES masters.Customers(Id)
    );
    PRINT '  + inventory.DeliveryChallans';
END
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 2. inventory.DeliveryChallanItems  (lines — one row per SO line shipped)
-- ─────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables
               WHERE object_id = OBJECT_ID('inventory.DeliveryChallanItems'))
BEGIN
    CREATE TABLE inventory.DeliveryChallanItems (
        Id                  INT             IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ChallanId           INT             NOT NULL,
        SalesOrderLineId    INT             NOT NULL,
        -- Exactly ONE of StockLotId / GrnId is non-null (enforced by service layer)
        StockLotId          INT             NULL,
        GrnId               INT             NULL,
        MaterialId          INT             NULL,
        Paper               NVARCHAR(200)   NULL,           -- snapshot for display
        Gsm                 INT             NULL,
        Size                NVARCHAR(50)    NULL,
        QuantityKg          DECIMAL(18,4)   NOT NULL,       -- weight in kg
        Rate                DECIMAL(18,2)   NULL,
        Remarks             NVARCHAR(500)   NULL,

        CreatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy           NVARCHAR(100)   NOT NULL,
        IsDeleted           BIT             NOT NULL DEFAULT 0,

        CONSTRAINT FK_DCItems_Challan FOREIGN KEY (ChallanId)
            REFERENCES inventory.DeliveryChallans(Id),
        CONSTRAINT FK_DCItems_SOLine  FOREIGN KEY (SalesOrderLineId)
            REFERENCES sales.SalesOrderLines(Id),
        CONSTRAINT FK_DCItems_Lot     FOREIGN KEY (StockLotId)
            REFERENCES inventory.StockLots(Id),
        CONSTRAINT FK_DCItems_GRN     FOREIGN KEY (GrnId)
            REFERENCES inventory.GRNs(Id)
    );

    CREATE INDEX IX_DCItems_Challan
        ON inventory.DeliveryChallanItems (ChallanId)
        WHERE IsDeleted = 0;
    CREATE INDEX IX_DCItems_SOLine
        ON inventory.DeliveryChallanItems (SalesOrderLineId)
        WHERE IsDeleted = 0;
    PRINT '  + inventory.DeliveryChallanItems';
END
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 3. sales.SalesOrderLines.DeliveredQty
--    Running total of kg shipped to customer; SO auto-closes when every
--    line has DeliveredQty >= Qty.
-- ─────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('sales.SalesOrderLines')
                 AND name = 'DeliveredQty')
BEGIN
    ALTER TABLE sales.SalesOrderLines
        ADD DeliveredQty DECIMAL(18,4) NOT NULL CONSTRAINT DF_SOLines_DeliveredQty DEFAULT 0;
    PRINT '  + DeliveredQty → sales.SalesOrderLines';
END
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Backfill existing SO lines' DeliveredQty by walking the (yet-to-exist)
--    DeliveryChallanItems sums. Safe re-run: 0 rows on first run because the
--    DCItems table is empty.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE sol
SET    sol.DeliveredQty = ISNULL(d.TotalDelivered, 0)
FROM   sales.SalesOrderLines sol
LEFT JOIN (
    SELECT SalesOrderLineId, SUM(QuantityKg) AS TotalDelivered
    FROM   inventory.DeliveryChallanItems
    WHERE  IsDeleted = 0
    GROUP BY SalesOrderLineId
) d ON d.SalesOrderLineId = sol.Id
WHERE  sol.IsDeleted = 0
  AND  sol.DeliveredQty <> ISNULL(d.TotalDelivered, 0);
PRINT CONCAT('  • Backfilled SOLines.DeliveredQty   rows=', @@ROWCOUNT);
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 5. DC number sequence (DC-2026-0001 …)
-- ─────────────────────────────────────────────────────────────────────────
DECLARE @Year INT = YEAR(GETDATE());
IF NOT EXISTS (SELECT 1 FROM system.NumberSequences
               WHERE Module = 'DC' AND [Year] = @Year)
BEGIN
    INSERT INTO system.NumberSequences (Module, [Year], LastNumber, Prefix, Padding, CreatedBy)
    VALUES ('DC', @Year, 0, 'DC', 4, 'SYSTEM');
    PRINT '  + NumberSequence DC (Delivery Challan) for current year';
END
GO

PRINT '── Migration 30 complete. ──────────────────────────────────';
GO
