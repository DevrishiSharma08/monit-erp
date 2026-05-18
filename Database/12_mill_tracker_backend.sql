-- ============================================================
-- FILE : 12_mill_tracker_backend.sql
-- DESC : Add missing columns to existing MillTracker tables
--        so the C# backend can store/retrieve all fields the
--        frontend MillOrderTracker interface requires.
-- RUN  : After 05_procurement_tables.sql
-- All statements are idempotent (safe to re-run).
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 12: mill tracker backend enhancements ─────────';
GO

-- ============================================================
-- 1. procurement.MillTrackers  — add denormalized + linking cols
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackers') AND name = 'PONumber')
BEGIN
    ALTER TABLE procurement.MillTrackers ADD PONumber NVARCHAR(20) NULL;
    PRINT '  + procurement.MillTrackers.PONumber';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackers') AND name = 'Description')
BEGIN
    ALTER TABLE procurement.MillTrackers ADD Description NVARCHAR(300) NULL;
    PRINT '  + procurement.MillTrackers.Description';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackers') AND name = 'GSM')
BEGIN
    ALTER TABLE procurement.MillTrackers ADD GSM INT NULL;
    PRINT '  + procurement.MillTrackers.GSM';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackers') AND name = 'Size')
BEGIN
    ALTER TABLE procurement.MillTrackers ADD Size NVARCHAR(50) NULL;
    PRINT '  + procurement.MillTrackers.Size';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackers') AND name = 'SoNumber')
BEGIN
    ALTER TABLE procurement.MillTrackers ADD SoNumber NVARCHAR(20) NULL;
    PRINT '  + procurement.MillTrackers.SoNumber';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackers') AND name = 'SoDeliveryDate')
BEGIN
    ALTER TABLE procurement.MillTrackers ADD SoDeliveryDate DATE NULL;
    PRINT '  + procurement.MillTrackers.SoDeliveryDate';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackers') AND name = 'SoCustomerId')
BEGIN
    ALTER TABLE procurement.MillTrackers ADD SoCustomerId INT NULL;
    PRINT '  + procurement.MillTrackers.SoCustomerId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MillTrackers_SoCustomer'
               AND parent_object_id = OBJECT_ID('procurement.MillTrackers'))
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackers') AND name = 'SoCustomerId')
BEGIN
    ALTER TABLE procurement.MillTrackers
        ADD CONSTRAINT FK_MillTrackers_SoCustomer
        FOREIGN KEY (SoCustomerId) REFERENCES masters.Customers(Id);
    PRINT '  + FK_MillTrackers_SoCustomer';
END
GO

-- Make MaterialId nullable (may have been NOT NULL in original schema)
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('procurement.MillTrackers')
             AND name = 'MaterialId' AND is_nullable = 0)
BEGIN
    ALTER TABLE procurement.MillTrackers ALTER COLUMN MaterialId INT NULL;
    PRINT '  ~ procurement.MillTrackers.MaterialId made nullable';
END
GO

-- ============================================================
-- 2. procurement.MillTrackerPartialDeliveries  — batch cols
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackerPartialDeliveries') AND name = 'BatchNo')
BEGIN
    ALTER TABLE procurement.MillTrackerPartialDeliveries ADD BatchNo INT NOT NULL DEFAULT 0;
    PRINT '  + procurement.MillTrackerPartialDeliveries.BatchNo';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackerPartialDeliveries') AND name = 'TruckNumber')
BEGIN
    ALTER TABLE procurement.MillTrackerPartialDeliveries ADD TruckNumber NVARCHAR(20) NULL;
    PRINT '  + procurement.MillTrackerPartialDeliveries.TruckNumber';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackerPartialDeliveries') AND name = 'MillInvoiceNo')
BEGIN
    ALTER TABLE procurement.MillTrackerPartialDeliveries ADD MillInvoiceNo NVARCHAR(50) NULL;
    PRINT '  + procurement.MillTrackerPartialDeliveries.MillInvoiceNo';
END
GO

-- ============================================================
-- 3. procurement.MillTrackerHistory  — add rich audit columns
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackerHistory') AND name = 'Action')
BEGIN
    ALTER TABLE procurement.MillTrackerHistory ADD Action NVARCHAR(200) NULL;
    PRINT '  + procurement.MillTrackerHistory.Action';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackerHistory') AND name = 'OldStatus')
BEGIN
    ALTER TABLE procurement.MillTrackerHistory ADD OldStatus NVARCHAR(50) NULL;
    PRINT '  + procurement.MillTrackerHistory.OldStatus';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackerHistory') AND name = 'NewStatus')
BEGIN
    ALTER TABLE procurement.MillTrackerHistory ADD NewStatus NVARCHAR(50) NULL;
    PRINT '  + procurement.MillTrackerHistory.NewStatus';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackerHistory') AND name = 'OldQty')
BEGIN
    ALTER TABLE procurement.MillTrackerHistory ADD OldQty DECIMAL(18,4) NULL;
    PRINT '  + procurement.MillTrackerHistory.OldQty';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.MillTrackerHistory') AND name = 'NewQty')
BEGIN
    ALTER TABLE procurement.MillTrackerHistory ADD NewQty DECIMAL(18,4) NULL;
    PRINT '  + procurement.MillTrackerHistory.NewQty';
END
GO

-- ============================================================
-- 4. Indexes for common query patterns
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MillTrackers_POId'
               AND object_id = OBJECT_ID('procurement.MillTrackers'))
BEGIN
    CREATE INDEX IX_MillTrackers_POId ON procurement.MillTrackers (POId) WHERE IsDeleted = 0;
    PRINT '  + IX_MillTrackers_POId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MillTrackers_Status'
               AND object_id = OBJECT_ID('procurement.MillTrackers'))
BEGIN
    CREATE INDEX IX_MillTrackers_Status ON procurement.MillTrackers (ProductionStatus) WHERE IsDeleted = 0;
    PRINT '  + IX_MillTrackers_Status';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MillTrackerBatches_TrackerId'
               AND object_id = OBJECT_ID('procurement.MillTrackerPartialDeliveries'))
BEGIN
    CREATE INDEX IX_MillTrackerBatches_TrackerId ON procurement.MillTrackerPartialDeliveries (TrackerId) WHERE IsDeleted = 0;
    PRINT '  + IX_MillTrackerBatches_TrackerId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MillTrackerHistory_TrackerId'
               AND object_id = OBJECT_ID('procurement.MillTrackerHistory'))
BEGIN
    CREATE INDEX IX_MillTrackerHistory_TrackerId ON procurement.MillTrackerHistory (TrackerId);
    PRINT '  + IX_MillTrackerHistory_TrackerId';
END
GO

PRINT '── Migration 12 complete. ─────────────────────────────────';
GO
