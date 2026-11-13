-- Migration 51: Add ShowCustomerName to procurement.PurchaseOrders
--
-- Client-reported 2026-09-11: the "Customer : ..." reference line in the PO
-- PDF's totals row used to print unconditionally whenever the PO was linked
-- to an SO — including on Blind-shipment POs, where it leaked the real
-- customer's identity to the mill, defeating the whole point of Blind mode.
--
-- ShowCustomerName is a per-PO, user-controlled toggle (default 0/off) that
-- now gates that line, the same way regardless of ShipmentMode (Normal /
-- Blind / InvoiceOverride). Billed To / Shipped To are untouched by this —
-- they keep behaving exactly as before.
--
-- Safe to run any number of times, on either DB. Run on BOTH MonitPaperDB
-- and MonitAssociatesDB.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'ShowCustomerName')
BEGIN
    ALTER TABLE procurement.PurchaseOrders ADD ShowCustomerName BIT NOT NULL CONSTRAINT DF_PurchaseOrders_ShowCustomerName DEFAULT 0;
    PRINT '  + procurement.PurchaseOrders.ShowCustomerName';
END
