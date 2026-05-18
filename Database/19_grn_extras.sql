-- ============================================================
-- FILE : 19_grn_extras.sql
-- DESC : Adds missing columns to inventory.GRNs and creates
--        inventory.GRNStatusLog for the full GRN workflow.
-- RUN  : After 06_inventory_tables.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ------------------------------------------------------------
-- Add Status column (most critical — drives the whole flow)
-- Draft → QC Pending → Approved → Stock Updated | Discrepancy Raised
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'Status'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD [Status] NVARCHAR(30) NOT NULL DEFAULT 'Draft';
    PRINT '  + inventory.GRNs.Status added';
END
GO

-- ------------------------------------------------------------
-- ReceivedBy — gate keeper / warehouse staff who received
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'ReceivedBy'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD ReceivedBy NVARCHAR(100) NULL;
    PRINT '  + inventory.GRNs.ReceivedBy added';
END
GO

-- ------------------------------------------------------------
-- MillTrackerUpdated — flag to avoid double-decrementing tracker qty
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'MillTrackerUpdated'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD MillTrackerUpdated BIT NOT NULL DEFAULT 0;
    PRINT '  + inventory.GRNs.MillTrackerUpdated added';
END
GO

-- ------------------------------------------------------------
-- SourceLoadPlanId — FK to the TruckLoadPlan that brought this material
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'SourceLoadPlanId'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD SourceLoadPlanId INT NULL;
    PRINT '  + inventory.GRNs.SourceLoadPlanId added';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_GRNs_TruckLoadPlan'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD CONSTRAINT FK_GRNs_TruckLoadPlan
            FOREIGN KEY (SourceLoadPlanId)
            REFERENCES procurement.TruckLoadPlans(Id);
    PRINT '  + FK_GRNs_TruckLoadPlan added';
END
GO

-- ------------------------------------------------------------
-- LinkedSOId — SO that this shipment was procured for
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'LinkedSOId'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD LinkedSOId INT NULL;
    PRINT '  + inventory.GRNs.LinkedSOId added';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_GRNs_LinkedSO'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD CONSTRAINT FK_GRNs_LinkedSO
            FOREIGN KEY (LinkedSOId)
            REFERENCES sales.SalesOrders(Id);
    PRINT '  + FK_GRNs_LinkedSO added';
END
GO

-- ------------------------------------------------------------
-- QC fields
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'QCApprovedBy'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD QCApprovedBy NVARCHAR(100) NULL;
    PRINT '  + inventory.GRNs.QCApprovedBy added';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'QCDate'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD QCDate DATE NULL;
    PRINT '  + inventory.GRNs.QCDate added';
END
GO

-- ------------------------------------------------------------
-- Size — denormalized string label (e.g. "70x100") for display
-- without always joining to masters.PaperSizes
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'Size'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD [Size] NVARCHAR(50) NULL;
    PRINT '  + inventory.GRNs.Size added';
END
GO

-- ------------------------------------------------------------
-- MillTrackerId — direct reference to the MillTracker row that
-- this GRN is closing out (avoids re-joining via POId+MaterialId)
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('inventory.GRNs') AND name = 'MillTrackerId'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD MillTrackerId INT NULL;
    PRINT '  + inventory.GRNs.MillTrackerId added';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_GRNs_MillTracker'
)
BEGIN
    ALTER TABLE inventory.GRNs
        ADD CONSTRAINT FK_GRNs_MillTracker
            FOREIGN KEY (MillTrackerId)
            REFERENCES procurement.MillTrackers(Id);
    PRINT '  + FK_GRNs_MillTracker added';
END
GO

-- ------------------------------------------------------------
-- inventory.GRNStatusLog
-- Immutable audit trail of every status transition on a GRN.
-- ------------------------------------------------------------
IF OBJECT_ID('inventory.GRNStatusLog', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.GRNStatusLog (
        Id          INT             IDENTITY(1,1)   NOT NULL,
        GRNId       INT             NOT NULL,
        FromStatus  NVARCHAR(30)    NULL,               -- NULL on first entry (Draft)
        ToStatus    NVARCHAR(30)    NOT NULL,
        Remarks     NVARCHAR(500)   NULL,
        ChangedBy   NVARCHAR(100)   NOT NULL,
        ChangedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),

        CONSTRAINT PK_GRNStatusLog      PRIMARY KEY (Id),
        CONSTRAINT FK_GRNStatusLog_GRN  FOREIGN KEY (GRNId)
                                        REFERENCES inventory.GRNs(Id)
    );

    CREATE INDEX IX_GRNStatusLog_GRNId ON inventory.GRNStatusLog (GRNId);
    PRINT '  + inventory.GRNStatusLog created';
END
GO

PRINT '✓ 19_grn_extras.sql complete.';
GO
