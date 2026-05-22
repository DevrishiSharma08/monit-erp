-- Migration V007: Add MillUnitId to PurchaseOrders
-- Purpose: Track which specific mill unit (branch/factory) a PO is placed with.

ALTER TABLE procurement.PurchaseOrders
    ADD MillUnitId INT NULL
        CONSTRAINT FK_PO_MillUnitId FOREIGN KEY REFERENCES masters.MillUnits(Id);
