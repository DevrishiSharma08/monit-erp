-- Migration 49: Widen procurement.PurchaseOrderItems.Discount precision
--
-- Bug: Discount was added via V005__PurchaseOrderItems_WeightKg_Discount.sql
-- as DECIMAL(6,4) — max ±99.9999. Every other Discount column in the schema
-- (masters.Rates.Discount, sales.SalesOrderLines.Discount) is DECIMAL(18,4).
-- PO's Discount later changed meaning from "% off" (fits fine under 100) to
-- a flat ₹/kg amount (does NOT reliably stay under 100 for higher-value
-- paper) — but this one column was never widened to match. Any PO item
-- with a discount >= 100 throws "Arithmetic overflow error converting
-- numeric to data type numeric" and the whole PO fails to save.
-- Client-reported: PO with 12 items, up to ~10 tons each, failed to save.
--
-- Safe to run any number of times, on either DB — ALTER COLUMN to a wider
-- precision never loses existing data (values that fit in DECIMAL(6,4)
-- fit in DECIMAL(18,4) unchanged). Run on BOTH MonitPaperDB and
-- MonitAssociatesDB.

ALTER TABLE procurement.PurchaseOrderItems ALTER COLUMN Discount DECIMAL(18,4) NULL;
