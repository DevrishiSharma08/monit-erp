-- Migration V005: Add WeightKg and Discount to PurchaseOrderItems
-- Purpose: Store billing weight (KG) and rate discount % per line item.
--          Rate master stores rate per KG; amount = WeightKg × (Rate × (1 - Discount/100))

ALTER TABLE procurement.PurchaseOrderItems
    ADD WeightKg DECIMAL(18, 3) NULL,
        Discount DECIMAL(6, 4) NULL;
