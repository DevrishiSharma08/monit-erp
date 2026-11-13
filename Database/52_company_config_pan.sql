-- Migration 52: Add PanNumber to system.CompanyConfig
--
-- Client-requested (2026-09-30): the new Delivery Challan PDF replicates a
-- Tally-style "Delivery Note" format that prints the company's PAN. PAN was
-- never stored anywhere for the company itself (only Transporters have a
-- PAN column, which is unrelated). Editable via the existing Company
-- Settings UI once added here.
--
-- Safe to run any number of times, on either DB. Run on BOTH MonitPaperDB
-- and MonitAssociatesDB.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('system.CompanyConfig') AND name = 'PanNumber')
BEGIN
    ALTER TABLE system.CompanyConfig ADD PanNumber NVARCHAR(20) NULL;
    PRINT '  + system.CompanyConfig.PanNumber';
END
