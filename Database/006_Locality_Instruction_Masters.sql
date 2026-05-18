-- ============================================================
-- Migration 006: Locality Master + Instruction Master
-- ============================================================
-- Run once on the target database.
-- Dependencies: masters schema must already exist.
-- ============================================================

-- ── 1. masters.Localities ────────────────────────────────────
CREATE TABLE masters.Localities (
    Id          INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Name        NVARCHAR(150) NOT NULL,
    City        NVARCHAR(100) NULL,
    State       NVARCHAR(100) NULL,
    Description NVARCHAR(500) NULL,
    IsActive    BIT           NOT NULL DEFAULT 1,

    -- Audit
    CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100) NOT NULL DEFAULT 'system',
    UpdatedAt   DATETIME2     NULL,
    UpdatedBy   NVARCHAR(100) NULL,

    -- Soft delete
    IsDeleted   BIT           NOT NULL DEFAULT 0,
    DeletedAt   DATETIME2     NULL,
    DeletedBy   NVARCHAR(100) NULL
);

CREATE INDEX IX_Localities_Name      ON masters.Localities (Name)      WHERE IsDeleted = 0;
CREATE INDEX IX_Localities_IsActive  ON masters.Localities (IsActive)  WHERE IsDeleted = 0;

-- ── 2. Optional: FK from Customers to Localities ─────────────
-- Only run if the Customers table exists and you want to enforce referential integrity.
-- Safe to skip — the backend handles LocalityId as a nullable soft-reference.
--
-- ALTER TABLE masters.Customers
--     ADD LocalityId INT NULL
--         CONSTRAINT FK_Customers_Locality FOREIGN KEY REFERENCES masters.Localities(Id);

-- If Customers already exists with a LocalityId column from a prior migration:
-- ALTER TABLE masters.Customers
--     ADD CONSTRAINT FK_Customers_Locality FOREIGN KEY (LocalityId) REFERENCES masters.Localities(Id);


-- ── 3. masters.Instructions ──────────────────────────────────
CREATE TABLE masters.Instructions (
    Id          INT              IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Title       NVARCHAR(200)    NULL,                      -- optional
    ApplicableTo NVARCHAR(10)    NOT NULL DEFAULT 'All',    -- 'All' | 'Specific'
    LinesJson   NVARCHAR(MAX)    NOT NULL DEFAULT '[]',     -- JSON array of strings

    IsActive    BIT              NOT NULL DEFAULT 1,

    -- Audit
    CreatedAt   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)    NOT NULL DEFAULT 'system',
    UpdatedAt   DATETIME2        NULL,
    UpdatedBy   NVARCHAR(100)    NULL,

    -- Soft delete
    IsDeleted   BIT              NOT NULL DEFAULT 0,
    DeletedAt   DATETIME2        NULL,
    DeletedBy   NVARCHAR(100)    NULL
);

CREATE INDEX IX_Instructions_Title     ON masters.Instructions (Title)     WHERE IsDeleted = 0;
CREATE INDEX IX_Instructions_IsActive  ON masters.Instructions (IsActive)  WHERE IsDeleted = 0;

-- ── 4. masters.InstructionMills (junction) ───────────────────
CREATE TABLE masters.InstructionMills (
    InstructionId INT NOT NULL,
    MillId        INT NOT NULL,
    CONSTRAINT PK_InstructionMills PRIMARY KEY (InstructionId, MillId),
    CONSTRAINT FK_InstructionMills_Instruction FOREIGN KEY (InstructionId)
        REFERENCES masters.Instructions(Id) ON DELETE CASCADE
    -- Note: no FK to Mills to avoid hard dependency; keep as soft reference
);

CREATE INDEX IX_InstructionMills_MillId ON masters.InstructionMills (MillId);

-- ── 5. Seed data (optional examples) ─────────────────────────
-- INSERT INTO masters.Localities (Name, City, State, CreatedBy)
-- VALUES ('Vijay Nagar',  'Indore', 'Madhya Pradesh', 'admin'),
--        ('Scheme 54',    'Indore', 'Madhya Pradesh', 'admin'),
--        ('Palasia',      'Indore', 'Madhya Pradesh', 'admin');

-- INSERT INTO masters.Instructions (Title, ApplicableTo, LinesJson, CreatedBy)
-- VALUES ('Standard Delivery Terms', 'All',
--         N'["Goods once sold will not be taken back.","Subject to Indore jurisdiction.","E & O.E."]',
--         'admin');
