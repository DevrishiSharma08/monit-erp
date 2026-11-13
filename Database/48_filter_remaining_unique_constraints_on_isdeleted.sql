-- ============================================================================
-- FILE : 48_filter_remaining_unique_constraints_on_isdeleted.sql
-- DESC : Follow-up to 47 — same "plain UNIQUE constraint on a soft-delete
--        table" bug, found via a full cross-schema audit (not just masters).
--        Every one of these tables is soft-delete only; once a row is
--        soft-deleted, its number/name/code permanently occupies the
--        unique key and can never be reused, even though the row is
--        invisible everywhere in the UI. Same fix as 47: drop the plain
--        UNIQUE constraint, replace with a filtered unique index
--        (WHERE IsDeleted = 0). No data changes.
--
--        system.NumberSequences and system.NotificationState are correctly
--        left alone — neither table has IsDeleted (no soft-delete there),
--        so a plain unique constraint is the right thing.
--
--        logistics.* tables here (Challans, ChallanLines, PickPlans,
--        PickPlanLines, InTransitTrackings, TruckLoadPlans,
--        TruckLoadPlanItems) are legacy/superseded — the live app uses
--        inventory.DeliveryChallans and procurement.TruckLoadPlans instead
--        (confirmed via repository code search: nothing queries the
--        logistics.* versions). Fixed anyway since it costs nothing and
--        makes them safe if ever revived.
-- ============================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ── auth ──────────────────────────────────────────────────────────────────
ALTER TABLE auth.Users         DROP CONSTRAINT UQ_Users_Username;
CREATE UNIQUE INDEX UQ_Users_Username ON auth.Users(Username) WHERE IsDeleted = 0;
GO
ALTER TABLE auth.Roles         DROP CONSTRAINT UQ_Roles_Name;
CREATE UNIQUE INDEX UQ_Roles_Name ON auth.Roles(Name) WHERE IsDeleted = 0;
GO
ALTER TABLE auth.Teams         DROP CONSTRAINT UQ_Teams_Name;
CREATE UNIQUE INDEX UQ_Teams_Name ON auth.Teams(Name) WHERE IsDeleted = 0;
GO
ALTER TABLE auth.TeamMembers   DROP CONSTRAINT UQ_TeamMembers;
CREATE UNIQUE INDEX UQ_TeamMembers ON auth.TeamMembers(TeamId, UserId) WHERE IsDeleted = 0;
GO

-- ── sales ─────────────────────────────────────────────────────────────────
ALTER TABLE sales.SalesOrders  DROP CONSTRAINT UQ_SalesOrders_Number;
CREATE UNIQUE INDEX UQ_SalesOrders_Number ON sales.SalesOrders(SONumber) WHERE IsDeleted = 0;
GO
ALTER TABLE sales.Inquiries    DROP CONSTRAINT UQ_Inquiries_Number;
CREATE UNIQUE INDEX UQ_Inquiries_Number ON sales.Inquiries(InquiryNumber) WHERE IsDeleted = 0;
GO

-- ── procurement ───────────────────────────────────────────────────────────
ALTER TABLE procurement.PurchaseOrders   DROP CONSTRAINT UQ_PurchaseOrders_Number;
CREATE UNIQUE INDEX UQ_PurchaseOrders_Number ON procurement.PurchaseOrders(PONumber) WHERE IsDeleted = 0;
GO
ALTER TABLE procurement.TruckLoadPlans   DROP CONSTRAINT UQ_TruckLoadPlans_PlanNumber;
CREATE UNIQUE INDEX UQ_TruckLoadPlans_PlanNumber ON procurement.TruckLoadPlans(PlanNumber) WHERE IsDeleted = 0;
GO

-- ── inventory ─────────────────────────────────────────────────────────────
ALTER TABLE inventory.GRNs               DROP CONSTRAINT UQ_GRNs_Number;
CREATE UNIQUE INDEX UQ_GRNs_Number ON inventory.GRNs(GRNNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE inventory.GRNs               DROP CONSTRAINT UQ_GRNs_LotNumber;
CREATE UNIQUE INDEX UQ_GRNs_LotNumber ON inventory.GRNs(LotNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE inventory.StockLots          DROP CONSTRAINT UQ_StockLots_LotNumber;
CREATE UNIQUE INDEX UQ_StockLots_LotNumber ON inventory.StockLots(LotNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE inventory.DispatchReceipts   DROP CONSTRAINT UQ_DispatchReceipts_Number;
CREATE UNIQUE INDEX UQ_DispatchReceipts_Number ON inventory.DispatchReceipts(DispatchNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE inventory.DeliveryChallans   DROP CONSTRAINT UQ_DeliveryChallans_Number;
CREATE UNIQUE INDEX UQ_DeliveryChallans_Number ON inventory.DeliveryChallans(ChallanNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE inventory.BinLocations       DROP CONSTRAINT UQ_BinLocations;
CREATE UNIQUE INDEX UQ_BinLocations ON inventory.BinLocations(WarehouseId, BinId) WHERE IsDeleted = 0;
GO

-- ── logistics (legacy/unused, fixed for safety only) ────────────────────────
ALTER TABLE logistics.Challans           DROP CONSTRAINT UQ_Challans_Number;
CREATE UNIQUE INDEX UQ_Challans_Number ON logistics.Challans(ChallanNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE logistics.ChallanLines       DROP CONSTRAINT UQ_ChallanLines;
CREATE UNIQUE INDEX UQ_ChallanLines ON logistics.ChallanLines(ChallanId, LineNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE logistics.PickPlans          DROP CONSTRAINT UQ_PickPlans_Number;
CREATE UNIQUE INDEX UQ_PickPlans_Number ON logistics.PickPlans(PlanNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE logistics.PickPlanLines      DROP CONSTRAINT UQ_PickPlanLines;
CREATE UNIQUE INDEX UQ_PickPlanLines ON logistics.PickPlanLines(PickPlanId, LineNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE logistics.InTransitTrackings DROP CONSTRAINT UQ_InTransitTrackings_Number;
CREATE UNIQUE INDEX UQ_InTransitTrackings_Number ON logistics.InTransitTrackings(TrackingNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE logistics.TruckLoadPlans     DROP CONSTRAINT UQ_TruckLoadPlans_Number;
CREATE UNIQUE INDEX UQ_TruckLoadPlans_Number ON logistics.TruckLoadPlans(PlanNumber) WHERE IsDeleted = 0;
GO
ALTER TABLE logistics.TruckLoadPlanItems DROP CONSTRAINT UQ_TruckLoadPlanItems;
CREATE UNIQUE INDEX UQ_TruckLoadPlanItems ON logistics.TruckLoadPlanItems(TLPId, LineNumber) WHERE IsDeleted = 0;
GO

PRINT 'DONE: 21 remaining unique constraints (auth/sales/procurement/inventory/logistics) converted to filtered (IsDeleted = 0) indexes.';
GO
