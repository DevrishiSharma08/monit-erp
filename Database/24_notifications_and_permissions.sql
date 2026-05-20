-- ============================================================
-- FILE : 24_notifications_and_permissions.sql
-- DESC : 1. system.NotificationState — per-user read/dismiss
--           tracking for live-derived notifications
--        2. Update Salesman role permissions to include
--           financial.hide_cost and contact.hide_phone
-- RUN  : After 23_email_config_and_sent_tracking.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ── 1. Notification state table ──────────────────────────────────────────────
-- Stores per-user read/dismissed state for live-derived notifications.
-- Notifications themselves are NOT stored here — they are derived on-demand
-- from live SO/PO/GRN/MillTracker data by the API.
-- NotifKey format: "SO-123", "PO-45", "GRN-12", "MILL-7"

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'system.NotificationState') AND type = 'U'
)
BEGIN
    CREATE TABLE system.NotificationState (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        UserId      INT          NOT NULL,
        NotifKey    NVARCHAR(50) NOT NULL,
        IsRead      BIT          NOT NULL DEFAULT 0,
        IsDismissed BIT          NOT NULL DEFAULT 0,
        UpdatedAt   DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_NotifState UNIQUE (UserId, NotifKey)
    );
    PRINT '✓ system.NotificationState created.';
END
ELSE
    PRINT '  system.NotificationState already exists — skipped.';
GO

-- ── 2. Update Salesman permissions to include data-restriction flags ──────────
UPDATE auth.Roles
SET Permissions = '["inquiry.read","inquiry.write","so.read","so.write","masters.read","financial.hide_cost","contact.hide_phone"]'
WHERE Name = 'Salesman' AND IsDeleted = 0;

PRINT '✓ Salesman role permissions updated with hide_cost + hide_phone.';
GO
