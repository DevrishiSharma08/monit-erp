-- ============================================================================
-- FILE : 31_dispatch_item_invoice.sql
-- DESC : Adds per-item invoice number on Dispatch Receipt items. The header
--        InvoiceNumber on inventory.DispatchReceipts stays as the primary
--        identifier (auto-derived from the first item if the user only enters
--        per-item invoice numbers), but each item can carry its own invoice
--        because the same truck may ship goods invoiced under different
--        mill invoice numbers (same pattern as GRN.ItemInvoiceNo).
--
-- RUN  : Anytime after 29_dispatch_receipt_and_grn_packings.sql.
-- Idempotent — safe to re-run.
-- ============================================================================

PRINT '── Migration 31: Dispatch item-level invoice number ─────────';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('inventory.DispatchReceiptItems')
                 AND name = 'ItemInvoiceNo')
BEGIN
    ALTER TABLE inventory.DispatchReceiptItems
        ADD ItemInvoiceNo NVARCHAR(50) NULL;
    PRINT '  + ItemInvoiceNo → inventory.DispatchReceiptItems';
END
GO

PRINT '── Migration 31 complete. ──────────────────────────────────';
GO
