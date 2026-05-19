-- Migration 23: SMTP email config + email sent tracking
-- Run once on all environments.

-- Add SMTP settings to the existing CompanyConfig singleton
ALTER TABLE system.CompanyConfig
    ADD SmtpSenderEmail NVARCHAR(200) NULL,
        SmtpSenderName  NVARCHAR(200) NULL,
        SmtpAppPassword NVARCHAR(500) NULL;   -- Gmail App Password (16 chars, no spaces)

-- Track when a confirmation email was last sent
ALTER TABLE sales.SalesOrders
    ADD EmailSentAt DATETIME NULL;

ALTER TABLE procurement.PurchaseOrders
    ADD EmailSentAt DATETIME NULL;

PRINT 'Migration 23 complete.';
GO
