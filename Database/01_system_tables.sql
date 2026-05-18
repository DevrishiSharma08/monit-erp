-- ============================================================
-- FILE : 01_system_tables.sql
-- DESC : System-level tables — number sequences, audit log,
--        notifications
-- RUN  : After 00_schemas.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ------------------------------------------------------------
-- system.NumberSequences
-- Generates formatted document numbers: SO-2024-0001
-- Thread-safe via UPDLOCK in stored procedure (see 09_seed)
-- ------------------------------------------------------------
IF OBJECT_ID('system.NumberSequences', 'U') IS NULL
CREATE TABLE system.NumberSequences (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    Module      NVARCHAR(20)    NOT NULL,   -- INQ, SO, PO, GRN, TLP, PP, CHN, TRK
    [Year]      INT             NOT NULL,
    LastNumber  INT             NOT NULL    DEFAULT 0,
    Prefix      NVARCHAR(10)    NOT NULL,   -- 'SO', 'PO', etc.
    Padding     INT             NOT NULL    DEFAULT 4,  -- SO-2024-0001 = 4 digits

    -- Audit
    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL    DEFAULT 'SYSTEM',
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_NumberSequences   PRIMARY KEY (Id),
    CONSTRAINT UQ_NumberSequences   UNIQUE (Module, [Year])
);
GO

-- ------------------------------------------------------------
-- system.AuditLogs
-- Records every INSERT / UPDATE / DELETE on critical tables.
-- Written by application layer (not triggers) for clarity.
-- ------------------------------------------------------------
IF OBJECT_ID('system.AuditLogs', 'U') IS NULL
CREATE TABLE system.AuditLogs (
    Id          BIGINT          IDENTITY(1,1)   NOT NULL,
    TableName   NVARCHAR(100)   NOT NULL,
    RecordId    INT             NOT NULL,
    Action      NVARCHAR(10)    NOT NULL,   -- INSERT / UPDATE / DELETE
    OldValues   NVARCHAR(MAX)   NULL,       -- JSON snapshot before change
    NewValues   NVARCHAR(MAX)   NULL,       -- JSON snapshot after change
    ChangedBy   NVARCHAR(100)   NOT NULL,
    ChangedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    IPAddress   NVARCHAR(45)    NULL,

    CONSTRAINT PK_AuditLogs PRIMARY KEY (Id)
);
GO

-- ------------------------------------------------------------
-- system.Notifications
-- App-generated notifications for bell panel in frontend.
-- UserId NULL = shown to all users.
-- Backend: insert a row whenever a relevant status changes.
-- ------------------------------------------------------------
IF OBJECT_ID('system.Notifications', 'U') IS NULL
CREATE TABLE system.Notifications (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    [Type]      NVARCHAR(20)    NOT NULL,       -- SO / PO / GRN / TLP / MILL
    Title       NVARCHAR(200)   NOT NULL,
    Body        NVARCHAR(500)   NOT NULL,
    RefId       INT             NULL,           -- FK to the referenced record
    RefNumber   NVARCHAR(50)    NULL,           -- Display: SO-2024-0001
    HRef        NVARCHAR(200)   NULL,           -- Frontend route: /orders
    UserId      INT             NULL,           -- NULL = broadcast to all
    IsRead      BIT             NOT NULL        DEFAULT 0,
    ReadAt      DATETIME2       NULL,

    -- Audit / soft-delete
    CreatedAt   DATETIME2       NOT NULL        DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL        DEFAULT 'SYSTEM',
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL        DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Notifications PRIMARY KEY (Id)
);
GO

PRINT '✓ system tables created.';
GO
