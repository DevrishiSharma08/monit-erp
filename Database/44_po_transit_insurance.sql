-- ============================================================================
-- FILE : 44_po_transit_insurance.sql
-- DESC : Adds Transit Insurance (InsurancePolicyNo) to Purchase Orders,
--        mirroring the field SO already has (sales.SalesOrders.InsurancePolicyNo,
--        added in 11_sales_order_backend.sql). The PO PDF previously hardcoded
--        "-" for Transit Insurance since the column never existed on the PO
--        side at all (client-reported).
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('procurement.PurchaseOrders') AND name = 'InsurancePolicyNo')
    ALTER TABLE procurement.PurchaseOrders ADD InsurancePolicyNo NVARCHAR(200) NULL;
GO
