-- ============================================================
-- FILE : 18_truck_load_plan_extras.sql
-- DESC : Add TruckType and FreightAmount columns to
--        procurement.TruckLoadPlans
-- RUN  : After 16_truck_load_plan.sql
-- Safe : Idempotent
-- ============================================================

USE MonitPaperDB;
GO

PRINT '── Migration 18: TruckLoadPlans extras ──────────────────';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('procurement.TruckLoadPlans')
                 AND name = 'TruckType')
BEGIN
    ALTER TABLE procurement.TruckLoadPlans
        ADD TruckType NVARCHAR(50) NULL;
    PRINT '  + Added TruckType';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('procurement.TruckLoadPlans')
                 AND name = 'FreightAmount')
BEGIN
    ALTER TABLE procurement.TruckLoadPlans
        ADD FreightAmount DECIMAL(12,2) NULL;
    PRINT '  + Added FreightAmount';
END
GO

PRINT '── Migration 18 complete. ──────────────────────────────────';
GO
