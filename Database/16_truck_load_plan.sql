-- ============================================================
-- FILE : 16_truck_load_plan.sql
-- DESC : Truck Load Plan tables — stores planned truck loads
--        created from ready mill tracker items.
-- RUN  : After 12_mill_tracker_backend.sql
-- All statements are idempotent (safe to re-run).
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 16: Truck Load Plan tables ────────────────────';
GO

-- ============================================================
-- 1. procurement.TruckLoadPlans — one row per truck load plan
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables
               WHERE object_id = OBJECT_ID('procurement.TruckLoadPlans'))
BEGIN
    CREATE TABLE procurement.TruckLoadPlans (
        Id                  INT IDENTITY(1,1)   NOT NULL PRIMARY KEY,
        PlanNumber          NVARCHAR(20)         NOT NULL,   -- TLP-2025-001
        PlanDate            DATE                 NOT NULL DEFAULT CAST(GETUTCDATE() AS DATE),
        TruckNumber         NVARCHAR(20)         NULL,
        TransporterName     NVARCHAR(150)        NULL,
        DriverName          NVARCHAR(100)        NULL,
        DriverPhone         NVARCHAR(20)         NULL,
        TruckCapacityKg     DECIMAL(10,2)        NULL,
        Origin              NVARCHAR(200)        NULL,
        DeliveryMode        NVARCHAR(50)         NOT NULL DEFAULT 'Direct To Customer',
        MillInvoiceNo       NVARCHAR(50)         NULL,
        DeliveryBillNo      NVARCHAR(50)         NULL,
        PlannedLoadDate     DATE                 NULL,
        PlannedDeliveryDate DATE                 NULL,
        ActualLoadDate      DATE                 NULL,
        ActualDeliveryDate  DATE                 NULL,
        [Status]            NVARCHAR(20)         NOT NULL DEFAULT 'Planned',
        Remarks             NVARCHAR(500)        NULL,
        IsDeleted           BIT                  NOT NULL DEFAULT 0,
        CreatedAt           DATETIME2            NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy           NVARCHAR(100)        NOT NULL,
        UpdatedAt           DATETIME2            NULL,
        UpdatedBy           NVARCHAR(100)        NULL,
        DeletedAt           DATETIME2            NULL,
        DeletedBy           NVARCHAR(100)        NULL,

        CONSTRAINT UQ_TruckLoadPlans_PlanNumber UNIQUE (PlanNumber)
    );
    PRINT '  + procurement.TruckLoadPlans';
END
GO

-- ============================================================
-- 2. procurement.TruckLoadPlanItems — line items per plan
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables
               WHERE object_id = OBJECT_ID('procurement.TruckLoadPlanItems'))
BEGIN
    CREATE TABLE procurement.TruckLoadPlanItems (
        Id               INT IDENTITY(1,1)   NOT NULL PRIMARY KEY,
        PlanId           INT                  NOT NULL,
        TrackerId        INT                  NULL,       -- FK → MillTrackers; NULL for manually-added items
        PoNumber         NVARCHAR(20)         NULL,
        SoNumber         NVARCHAR(20)         NULL,
        Paper            NVARCHAR(200)        NULL,
        Gsm              INT                  NULL,
        [Size]           NVARCHAR(50)         NULL,
        CustomerName     NVARCHAR(150)        NULL,
        Mill             NVARCHAR(150)        NULL,
        Quantity         DECIMAL(18,4)        NOT NULL,
        WeightKg         DECIMAL(10,2)        NULL,
        LoadOrder        INT                  NOT NULL DEFAULT 1,
        DeliveryLocation NVARCHAR(200)        NULL,
        DeliveryAddress  NVARCHAR(500)        NULL,
        MillInvoiceNo    NVARCHAR(50)         NULL,
        DeliveryBillNo   NVARCHAR(50)         NULL,
        IsDeleted        BIT                  NOT NULL DEFAULT 0,
        CreatedAt        DATETIME2            NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_TLPItems_Plan
            FOREIGN KEY (PlanId) REFERENCES procurement.TruckLoadPlans(Id),
        CONSTRAINT FK_TLPItems_Tracker
            FOREIGN KEY (TrackerId) REFERENCES procurement.MillTrackers(Id)
    );
    PRINT '  + procurement.TruckLoadPlanItems';
END
GO

-- ============================================================
-- 3. Indexes
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_TruckLoadPlans_Status'
                 AND object_id = OBJECT_ID('procurement.TruckLoadPlans'))
BEGIN
    CREATE INDEX IX_TruckLoadPlans_Status
        ON procurement.TruckLoadPlans ([Status])
        WHERE IsDeleted = 0;
    PRINT '  + IX_TruckLoadPlans_Status';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_TruckLoadPlans_PlannedLoadDate'
                 AND object_id = OBJECT_ID('procurement.TruckLoadPlans'))
BEGIN
    CREATE INDEX IX_TruckLoadPlans_PlannedLoadDate
        ON procurement.TruckLoadPlans (PlannedLoadDate)
        WHERE IsDeleted = 0;
    PRINT '  + IX_TruckLoadPlans_PlannedLoadDate';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_TLPItems_PlanId'
                 AND object_id = OBJECT_ID('procurement.TruckLoadPlanItems'))
BEGIN
    CREATE INDEX IX_TLPItems_PlanId
        ON procurement.TruckLoadPlanItems (PlanId)
        WHERE IsDeleted = 0;
    PRINT '  + IX_TLPItems_PlanId';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_TLPItems_TrackerId'
                 AND object_id = OBJECT_ID('procurement.TruckLoadPlanItems'))
BEGIN
    CREATE INDEX IX_TLPItems_TrackerId
        ON procurement.TruckLoadPlanItems (TrackerId)
        WHERE IsDeleted = 0 AND TrackerId IS NOT NULL;
    PRINT '  + IX_TLPItems_TrackerId';
END
GO

PRINT '── Migration 16 complete. ──────────────────────────────────';
GO
