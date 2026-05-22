-- Migration V006: Add Remarks to SalesOrderLines
-- Purpose: Store per-item optional notes on a sales order line.

ALTER TABLE sales.SalesOrderLines
    ADD Remarks NVARCHAR(500) NULL;

