-- ============================================================================
-- FILE : 47_filter_master_unique_constraints_on_isdeleted.sql
-- DESC : Every masters.* table with a Code/Label-style UNIQUE constraint was
--        using a PLAIN unique constraint (not filtered on IsDeleted) even
--        though every one of these tables is soft-delete only. Once a row
--        is soft-deleted, its Code permanently occupies the unique key —
--        nobody can ever create a new (or re-add the same) Material/Mill/
--        HsnCode/ItemType/PaperSize/Salesman/StockCategory/MillQualityGsm/
--        WarehouseBin with that code again, even though the row is
--        invisible everywhere in the UI.
--
--        Client-reported (live, MonitAssociatesDB): a user created material
--        "NR5/GB/360/50.5x104", deleted it ~30 min later, then tried to
--        re-add the exact same code — 500 error (UNIQUE KEY constraint
--        violation), and the same code also failed via the SO/PO free-text
--        auto-provisioner for the same underlying reason.
--
--        Fix: drop each plain UNIQUE constraint and replace it with a
--        FILTERED unique index (WHERE IsDeleted = 0) — active rows still
--        can't collide, but a soft-deleted row's code becomes reusable
--        immediately. No data changes; safe to run with existing
--        soft-deleted duplicates already in the table (the filtered index
--        only cares about currently-active rows).
-- ============================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

ALTER TABLE masters.Materials        DROP CONSTRAINT UQ_Materials_Code;
CREATE UNIQUE INDEX UQ_Materials_Code ON masters.Materials(Code) WHERE IsDeleted = 0;
GO

ALTER TABLE masters.HsnCodes         DROP CONSTRAINT UQ_HsnCodes_Code;
CREATE UNIQUE INDEX UQ_HsnCodes_Code ON masters.HsnCodes(Code) WHERE IsDeleted = 0;
GO

ALTER TABLE masters.ItemTypes        DROP CONSTRAINT UQ_ItemTypes_Code;
CREATE UNIQUE INDEX UQ_ItemTypes_Code ON masters.ItemTypes(Code) WHERE IsDeleted = 0;
GO

ALTER TABLE masters.MillQualityGsm   DROP CONSTRAINT UQ_MillQualityGsm_Code;
CREATE UNIQUE INDEX UQ_MillQualityGsm_Code ON masters.MillQualityGsm(Code) WHERE IsDeleted = 0;
GO

ALTER TABLE masters.MillQualityGsm   DROP CONSTRAINT UQ_MillQualityGsm_Combo;
CREATE UNIQUE INDEX UQ_MillQualityGsm_Combo ON masters.MillQualityGsm(MillId, QualityId, GsmMin, GsmMax, [Type]) WHERE IsDeleted = 0;
GO

ALTER TABLE masters.Mills            DROP CONSTRAINT UQ_Mills_Code;
CREATE UNIQUE INDEX UQ_Mills_Code ON masters.Mills(Code) WHERE IsDeleted = 0;
GO

ALTER TABLE masters.PaperSizes       DROP CONSTRAINT UQ_PaperSizes_Label;
CREATE UNIQUE INDEX UQ_PaperSizes_Label ON masters.PaperSizes(Label) WHERE IsDeleted = 0;
GO

ALTER TABLE masters.Salesmen         DROP CONSTRAINT UQ_Salesmen_Code;
CREATE UNIQUE INDEX UQ_Salesmen_Code ON masters.Salesmen(Code) WHERE IsDeleted = 0;
GO

ALTER TABLE masters.StockCategories  DROP CONSTRAINT UQ_StockCategories_Code;
CREATE UNIQUE INDEX UQ_StockCategories_Code ON masters.StockCategories(Code) WHERE IsDeleted = 0;
GO

ALTER TABLE masters.WarehouseBins    DROP CONSTRAINT UQ_WarehouseBins;
CREATE UNIQUE INDEX UQ_WarehouseBins ON masters.WarehouseBins(WarehouseId, BinCode) WHERE IsDeleted = 0;
GO

PRINT 'DONE: 10 master-table unique constraints converted to filtered (IsDeleted = 0) indexes.';
GO
