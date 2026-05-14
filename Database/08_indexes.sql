-- ============================================================
-- FILE : 08_indexes.sql
-- DESC : Performance indexes on all high-traffic columns.
--        FKs are NOT automatically indexed in SQL Server —
--        every FK used in a JOIN must be listed here.
-- RUN  : After 07_logistics_tables.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ============================================================
-- system
-- ============================================================
CREATE NONCLUSTERED INDEX IX_Notifications_UserId_IsRead
    ON system.Notifications (UserId, IsRead)
    INCLUDE (Type, Title, RefNumber, CreatedAt)
    WHERE IsDeleted = 0;
GO

-- ============================================================
-- auth
-- ============================================================
CREATE NONCLUSTERED INDEX IX_Users_Role
    ON auth.Users (Role)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_TeamMembers_UserId
    ON auth.TeamMembers (UserId)
    WHERE IsDeleted = 0;
GO

-- ============================================================
-- masters
-- ============================================================
CREATE NONCLUSTERED INDEX IX_MillContacts_MillId
    ON masters.MillContacts (MillId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_MillUnits_MillId
    ON masters.MillUnits (MillId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_StockCategories_StockGroupId
    ON masters.StockCategories (StockGroupId)
    WHERE IsDeleted = 0;
GO

-- Materials: most queried by mill, category, GSM, size
CREATE NONCLUSTERED INDEX IX_Materials_MillId
    ON masters.Materials (MillId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_Materials_CategoryId
    ON masters.Materials (CategoryId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_Materials_GSM_SizeId
    ON masters.Materials (GSM, SizeId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_CustomerContacts_CustomerId
    ON masters.CustomerContacts (CustomerId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_CustomerDeliveryLocations_CustomerId
    ON masters.CustomerDeliveryLocations (CustomerId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_WarehouseBins_WarehouseId
    ON masters.WarehouseBins (WarehouseId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_TransporterVehicles_TransporterId
    ON masters.TransporterVehicles (TransporterId)
    WHERE IsDeleted = 0;
GO

-- Rates lookup: by material, customer, date range
CREATE NONCLUSTERED INDEX IX_Rates_MaterialId_RateType
    ON masters.Rates (MaterialId, RateType)
    INCLUDE (CustomerId, MillId, SaleRate, PurchaseRate, EffectiveFrom, EffectiveTo)
    WHERE IsDeleted = 0;
GO

-- ============================================================
-- sales
-- ============================================================
CREATE NONCLUSTERED INDEX IX_Inquiries_CustomerId
    ON sales.Inquiries (CustomerId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_Inquiries_Status
    ON sales.Inquiries ([Status])
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_Inquiries_SalesmanId
    ON sales.Inquiries (SalesmanId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_InquiryRequirements_InquiryId
    ON sales.InquiryRequirements (InquiryId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_InquiryRequirements_MaterialId
    ON sales.InquiryRequirements (MaterialId)
    WHERE IsDeleted = 0;
GO

-- SalesOrders: most common filters
CREATE NONCLUSTERED INDEX IX_SalesOrders_CustomerId
    ON sales.SalesOrders (CustomerId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_SalesOrders_Status
    ON sales.SalesOrders ([Status])
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_SalesOrders_OrderDate
    ON sales.SalesOrders (OrderDate DESC)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_SalesOrders_SalesmanId
    ON sales.SalesOrders (SalesmanId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_SalesOrderLines_SOId
    ON sales.SalesOrderLines (SOId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_SalesOrderLines_MaterialId
    ON sales.SalesOrderLines (MaterialId)
    WHERE IsDeleted = 0;
GO

-- ============================================================
-- procurement
-- ============================================================
CREATE NONCLUSTERED INDEX IX_PurchaseOrders_MillId
    ON procurement.PurchaseOrders (MillId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_PurchaseOrders_Status
    ON procurement.PurchaseOrders ([Status])
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_PurchaseOrders_OrderDate
    ON procurement.PurchaseOrders (OrderDate DESC)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_PurchaseOrders_LinkedSOId
    ON procurement.PurchaseOrders (LinkedSOId)
    WHERE IsDeleted = 0 AND LinkedSOId IS NOT NULL;
GO

CREATE NONCLUSTERED INDEX IX_PurchaseOrderItems_POId
    ON procurement.PurchaseOrderItems (POId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_PurchaseOrderItems_MaterialId
    ON procurement.PurchaseOrderItems (MaterialId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_MillTrackers_POId
    ON procurement.MillTrackers (POId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_MillTrackers_MaterialId
    ON procurement.MillTrackers (MaterialId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_MillTrackers_ProductionStatus
    ON procurement.MillTrackers (ProductionStatus)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_MillTrackerHistory_TrackerId
    ON procurement.MillTrackerHistory (TrackerId);
GO

-- ============================================================
-- inventory
-- ============================================================

-- GRNs: searched by PO, material, date
CREATE NONCLUSTERED INDEX IX_GRNs_POId
    ON inventory.GRNs (POId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_GRNs_MaterialId
    ON inventory.GRNs (MaterialId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_GRNs_GRNDate
    ON inventory.GRNs (GRNDate DESC)
    WHERE IsDeleted = 0;
GO

-- StockLots: FIFO query = MaterialId + Status + FIFOSequence
CREATE NONCLUSTERED INDEX IX_StockLots_MaterialId_Status_FIFO
    ON inventory.StockLots (MaterialId, [Status], FIFOSequence)
    INCLUDE (LotNumber, CurrentQty, ReservedQty, AvailableQty,
             WarehouseId, BinLocationId, GRNDate)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_StockLots_GRNId
    ON inventory.StockLots (GRNId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_StockAllocations_SOId
    ON inventory.StockAllocations (SOId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_StockAllocations_StockLotId
    ON inventory.StockAllocations (StockLotId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_PurchaseAllocations_SOLineId
    ON inventory.PurchaseAllocations (SOLineId)
    WHERE IsDeleted = 0;
GO

-- ============================================================
-- logistics
-- ============================================================
CREATE NONCLUSTERED INDEX IX_PickPlans_SOId
    ON logistics.PickPlans (SOId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_PickPlanLines_PickPlanId
    ON logistics.PickPlanLines (PickPlanId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_TruckLoadPlans_Status
    ON logistics.TruckLoadPlans ([Status])
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_TruckLoadPlanItems_TLPId
    ON logistics.TruckLoadPlanItems (TLPId)
    WHERE IsDeleted = 0;
GO

-- Coverage engine query: material in active TLPs
CREATE NONCLUSTERED INDEX IX_TruckLoadPlanItems_MaterialId
    ON logistics.TruckLoadPlanItems (MaterialId)
    INCLUDE (Quantity, TLPId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_Challans_CustomerId
    ON logistics.Challans (CustomerId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_Challans_SOId
    ON logistics.Challans (SOId)
    WHERE IsDeleted = 0 AND SOId IS NOT NULL;
GO

CREATE NONCLUSTERED INDEX IX_ChallanLines_ChallanId
    ON logistics.ChallanLines (ChallanId)
    WHERE IsDeleted = 0;
GO

CREATE NONCLUSTERED INDEX IX_InTransitTrackings_Status
    ON logistics.InTransitTrackings (CurrentStatus)
    WHERE IsDeleted = 0;
GO

PRINT '✓ Indexes created.';
GO
