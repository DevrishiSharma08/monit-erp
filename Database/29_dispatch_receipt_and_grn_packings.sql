-- ============================================================================
-- FILE : 29_dispatch_receipt_and_grn_packings.sql
-- DESC : Splits the receiving flow into two stages:
--          1. DISPATCH stage — separate inventory.DispatchReceipts entity.
--             A dispatch user enters only invoice/date/qty info from the mill,
--             without seeing the full PO/SO context. One DispatchReceipt per
--             arriving truck load.
--          2. GRN stage — existing inventory.GRNs continues to hold the
--             warehouse-side packing, weight, QC, and routing work. Each
--             GRN now links back to its parent DispatchReceipt and may have
--             MULTIPLE packing rows (new inventory.GRNPackings child table)
--             — supports mixed sheet packings AND reel batch-wise entries
--             in a single table.
--
-- TABLES ADDED
--   inventory.DispatchReceipts          (header)
--   inventory.DispatchReceiptItems      (line items copied from TLP)
--   inventory.GRNPackings               (child of GRNs — multi-row packing)
--
-- COLUMNS ADDED
--   inventory.GRNs.DispatchReceiptId    (FK back to dispatch)
--
-- RUN  : Anytime after 16_truck_load_plan.sql + the inventory tables exist.
-- Idempotent — safe to re-run.
-- ============================================================================

PRINT '── Migration 29: Dispatch receipt + GRN multi-packing ───────';
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 1. inventory.DispatchReceipts  (header — one per truck arrival)
-- ─────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables
               WHERE object_id = OBJECT_ID('inventory.DispatchReceipts'))
BEGIN
    CREATE TABLE inventory.DispatchReceipts (
        Id                  INT             IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DispatchNumber      NVARCHAR(20)    NOT NULL,
        DispatchDate        DATE            NOT NULL,
        SourceLoadPlanId    INT             NOT NULL,
        InvoiceNumber       NVARCHAR(50)    NOT NULL,
        InvoiceDate         DATE            NULL,
        MillChallanNumber   NVARCHAR(50)    NULL,
        LRNumber            NVARCHAR(50)    NULL,
        VehicleNumber       NVARCHAR(20)    NULL,
        ReceivedBy          NVARCHAR(100)   NULL,           -- dispatch user
        Remarks             NVARCHAR(500)   NULL,
        -- workflow status
        Status              NVARCHAR(50)    NOT NULL DEFAULT 'Pending GRN',
            -- Pending GRN  → waiting for warehouse to start GRN
            -- Partial GRN  → some items GRN-ed
            -- GRN Done     → all items received & GRN created

        CreatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy           NVARCHAR(100)   NOT NULL,
        UpdatedAt           DATETIME2       NULL,
        UpdatedBy           NVARCHAR(100)   NULL,
        IsDeleted           BIT             NOT NULL DEFAULT 0,
        DeletedAt           DATETIME2       NULL,
        DeletedBy           NVARCHAR(100)   NULL,

        CONSTRAINT UQ_DispatchReceipts_Number UNIQUE (DispatchNumber),
        CONSTRAINT FK_DispatchReceipts_TLP   FOREIGN KEY (SourceLoadPlanId)
            REFERENCES procurement.TruckLoadPlans(Id)
    );
    PRINT '  + inventory.DispatchReceipts';
END
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 2. inventory.DispatchReceiptItems  (line items — one row per TLP item)
-- ─────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables
               WHERE object_id = OBJECT_ID('inventory.DispatchReceiptItems'))
BEGIN
    CREATE TABLE inventory.DispatchReceiptItems (
        Id                  INT             IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DispatchReceiptId   INT             NOT NULL,
        SourceTrackerId     INT             NULL,           -- FK to procurement.MillTrackers
        SourceTlpItemId     INT             NULL,           -- FK to procurement.TruckLoadPlanItems
        MaterialId          INT             NULL,           -- denormalised for quick lookup
        DispatchedQty       DECIMAL(18,4)   NOT NULL,       -- weight in kg
        Remarks             NVARCHAR(500)   NULL,

        CreatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy           NVARCHAR(100)   NOT NULL,
        IsDeleted           BIT             NOT NULL DEFAULT 0,

        CONSTRAINT FK_DispatchReceiptItems_DR
            FOREIGN KEY (DispatchReceiptId) REFERENCES inventory.DispatchReceipts(Id)
    );

    CREATE INDEX IX_DispatchReceiptItems_DR
        ON inventory.DispatchReceiptItems (DispatchReceiptId)
        WHERE IsDeleted = 0;
    PRINT '  + inventory.DispatchReceiptItems';
END
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 3. inventory.GRNs.DispatchReceiptId  (link GRN back to its dispatch)
-- ─────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('inventory.GRNs')
                 AND name = 'DispatchReceiptId')
BEGIN
    ALTER TABLE inventory.GRNs
        ADD DispatchReceiptId INT NULL
            CONSTRAINT FK_GRNs_DispatchReceipt
                FOREIGN KEY REFERENCES inventory.DispatchReceipts(Id);
    PRINT '  + DispatchReceiptId → inventory.GRNs';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_GRNs_DispatchReceiptId'
                 AND object_id = OBJECT_ID('inventory.GRNs'))
BEGIN
    CREATE INDEX IX_GRNs_DispatchReceiptId
        ON inventory.GRNs (DispatchReceiptId)
        WHERE DispatchReceiptId IS NOT NULL AND IsDeleted = 0;
    PRINT '  + IX_GRNs_DispatchReceiptId';
END
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 4. inventory.GRNPackings  (child of GRNs — multi-row packing)
--    One table covers both:
--      • SHEET items   → SheetsPerPacket, NoOfPackets, etc; BatchNo = NULL
--      • REEL items    → BatchNo + WeightKg; sheet fields = NULL
--    User may add multiple rows per GRN (different packings of same item).
-- ─────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables
               WHERE object_id = OBJECT_ID('inventory.GRNPackings'))
BEGIN
    CREATE TABLE inventory.GRNPackings (
        Id                  INT             IDENTITY(1,1) NOT NULL PRIMARY KEY,
        GRNId               INT             NOT NULL,
        PackingFormat       NVARCHAR(20)    NOT NULL,       -- 'Sheet' | 'Reel'

        -- Sheet packing (NULL for reel)
        SheetsPerPacket     INT             NULL,
        NoOfPackets         INT             NULL,
        PacketsPerBundle    INT             NULL,
        NoOfBundles         INT             NULL,

        -- Reel packing (NULL for sheet)
        BatchNo             NVARCHAR(50)    NULL,

        -- Common
        WeightKg            DECIMAL(18,4)   NOT NULL,
        Remarks             NVARCHAR(500)   NULL,

        CreatedAt           DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy           NVARCHAR(100)   NOT NULL,
        IsDeleted           BIT             NOT NULL DEFAULT 0,

        CONSTRAINT FK_GRNPackings_GRN
            FOREIGN KEY (GRNId) REFERENCES inventory.GRNs(Id),
        CONSTRAINT CHK_GRNPackings_Format
            CHECK (PackingFormat IN ('Sheet', 'Reel'))
    );

    CREATE INDEX IX_GRNPackings_GRN
        ON inventory.GRNPackings (GRNId)
        WHERE IsDeleted = 0;
    PRINT '  + inventory.GRNPackings';
END
GO

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Number sequence for Dispatch Receipt (DR-2026-0001 …)
-- ─────────────────────────────────────────────────────────────────────────
DECLARE @Year INT = YEAR(GETDATE());
IF NOT EXISTS (SELECT 1 FROM system.NumberSequences
               WHERE Module = 'DR' AND [Year] = @Year)
BEGIN
    INSERT INTO system.NumberSequences (Module, [Year], LastNumber, Prefix, Padding, CreatedBy)
    VALUES ('DR', @Year, 0, 'DR', 4, 'SYSTEM');
    PRINT '  + NumberSequence DR (Dispatch Receipt) for current year';
END
GO

PRINT '── Migration 29 complete. ──────────────────────────────────';
GO
