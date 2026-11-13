-- Migration 50: Add ShowDeliveryParty to procurement.PurchaseOrders
--
-- Client-requested: when a PO is raised Against an SO where the SO's order
-- customer (A) differs from its delivery party (B), the mill should see A
-- by default (today's unchanged behaviour) — but the user can opt in, per
-- PO, to reveal B (name + delivery address) on the Shipped To section and
-- PDF instead. Default 0 (off) preserves current behaviour for every
-- existing PO with no migration-time behaviour change.
--
-- Safe to run any number of times, on either DB. Run on BOTH MonitPaperDB
-- and MonitAssociatesDB.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'ShowDeliveryParty')
BEGIN
    ALTER TABLE procurement.PurchaseOrders ADD ShowDeliveryParty BIT NOT NULL CONSTRAINT DF_PurchaseOrders_ShowDeliveryParty DEFAULT 0;
    PRINT '  + procurement.PurchaseOrders.ShowDeliveryParty';
END
