-- ============================================================
-- FILE : 26_tlp_loads.sql
-- DESC : Add named Loads to Truck Load Plans (Option B).
--        Each TLP can have multiple loads (Load 1/2/3/Last Load)
--        each with its own delivery address and sequence.
--        Items link back to a load via LoadId FK.
-- RUN  : After 16_truck_load_plan.sql
-- Idempotent — safe to re-run.
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 26: TLP Loads ─────────────────────────────────';
GO

-- ============================================================
-- 1. procurement.TruckLoadPlanLoads
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables
               WHERE object_id = OBJECT_ID('procurement.TruckLoadPlanLoads'))
BEGIN
    CREATE TABLE procurement.TruckLoadPlanLoads (
        Id           INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
        PlanId       INT           NOT NULL,
        LoadType     NVARCHAR(20)  NOT NULL,   -- 'Load 1' | 'Load 2' | 'Load 3' | 'Last Load'
        LoadSequence INT           NOT NULL DEFAULT 1,
        Address      NVARCHAR(500) NULL,
        IsDeleted    BIT           NOT NULL DEFAULT 0,
        CreatedAt    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_TLPL_Plan FOREIGN KEY (PlanId)
            REFERENCES procurement.TruckLoadPlans(Id)
    );
    PRINT '  + procurement.TruckLoadPlanLoads';
END
GO

-- ============================================================
-- 2. Add LoadId + PlanQty to TruckLoadPlanItems
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('procurement.TruckLoadPlanItems')
                 AND name = 'LoadId')
BEGIN
    ALTER TABLE procurement.TruckLoadPlanItems
        ADD LoadId  INT           NULL
                CONSTRAINT FK_TLPI_Load FOREIGN KEY
                    REFERENCES procurement.TruckLoadPlanLoads(Id),
            PlanQty DECIMAL(18,3) NULL;
    PRINT '  + LoadId, PlanQty → procurement.TruckLoadPlanItems';
END
GO

-- ============================================================
-- 3. Index on LoadId
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_TLPItems_LoadId'
                 AND object_id = OBJECT_ID('procurement.TruckLoadPlanItems'))
BEGIN
    CREATE INDEX IX_TLPItems_LoadId
        ON procurement.TruckLoadPlanItems (LoadId)
        WHERE IsDeleted = 0 AND LoadId IS NOT NULL;
    PRINT '  + IX_TLPItems_LoadId';
END
GO

PRINT '── Migration 26 complete. ──────────────────────────────────';
GO
