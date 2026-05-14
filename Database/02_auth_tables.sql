-- ============================================================
-- FILE : 02_auth_tables.sql
-- DESC : Authentication — roles, users, teams, team members
-- RUN  : After 01_system_tables.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ------------------------------------------------------------
-- auth.Roles
-- Named roles with a JSON permission list.
-- Seed roles: Admin, Manager, Salesman, Planner,
--             Accounts, Warehouse Manager
-- ------------------------------------------------------------
IF OBJECT_ID('auth.Roles', 'U') IS NULL
CREATE TABLE auth.Roles (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    Name            NVARCHAR(100)   NOT NULL,
    Description     NVARCHAR(500)   NULL,
    Permissions     NVARCHAR(MAX)   NULL,   -- JSON array: ["inquiry.read","so.write",...]
    IsActive        BIT             NOT NULL    DEFAULT 1,

    CreatedAt       DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy       NVARCHAR(100)   NOT NULL,
    UpdatedAt       DATETIME2       NULL,
    UpdatedBy       NVARCHAR(100)   NULL,
    IsDeleted       BIT             NOT NULL    DEFAULT 0,
    DeletedAt       DATETIME2       NULL,
    DeletedBy       NVARCHAR(100)   NULL,

    CONSTRAINT PK_Roles         PRIMARY KEY (Id),
    CONSTRAINT UQ_Roles_Name    UNIQUE (Name)
);
GO

-- ------------------------------------------------------------
-- auth.Users
-- Application users. Password stored as plain text.
-- Role is denormalized (stored as string) for fast JWT claims.
-- ------------------------------------------------------------
IF OBJECT_ID('auth.Users', 'U') IS NULL
CREATE TABLE auth.Users (
    Id                  INT             IDENTITY(1,1)   NOT NULL,
    Username            NVARCHAR(100)   NOT NULL,
    Email               NVARCHAR(200)   NULL,
    Password            NVARCHAR(200)   NOT NULL,
    Name                NVARCHAR(200)   NOT NULL,
    RoleId              INT             NOT NULL,
    Role                NVARCHAR(100)   NOT NULL,       -- Denormalized: Admin / Manager / etc.
    CustomerName        NVARCHAR(200)   NULL,           -- Phase 2: customer-login users only
    IsActive            BIT             NOT NULL        DEFAULT 1,
    LastLoginAt         DATETIME2       NULL,
    RefreshToken        NVARCHAR(500)   NULL,
    RefreshTokenExpiry  DATETIME2       NULL,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Users             PRIMARY KEY (Id),
    CONSTRAINT UQ_Users_Username    UNIQUE (Username),
    CONSTRAINT FK_Users_Role        FOREIGN KEY (RoleId)
                                    REFERENCES auth.Roles(Id)
);
GO

-- ------------------------------------------------------------
-- auth.Teams
-- Logical groupings (e.g., Sales Team, Dispatch Team).
-- ------------------------------------------------------------
IF OBJECT_ID('auth.Teams', 'U') IS NULL
CREATE TABLE auth.Teams (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    Name        NVARCHAR(200)   NOT NULL,
    Description NVARCHAR(500)   NULL,
    ManagerId   INT             NULL,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Teams         PRIMARY KEY (Id),
    CONSTRAINT UQ_Teams_Name    UNIQUE (Name),
    CONSTRAINT FK_Teams_Manager FOREIGN KEY (ManagerId) REFERENCES auth.Users(Id)
);
GO

-- ------------------------------------------------------------
-- auth.TeamMembers  (Many-to-many: Users <-> Teams)
-- ------------------------------------------------------------
IF OBJECT_ID('auth.TeamMembers', 'U') IS NULL
CREATE TABLE auth.TeamMembers (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    TeamId      INT             NOT NULL,
    UserId      INT             NOT NULL,
    JoinedAt    DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_TeamMembers       PRIMARY KEY (Id),
    CONSTRAINT UQ_TeamMembers       UNIQUE (TeamId, UserId),
    CONSTRAINT FK_TeamMembers_Team  FOREIGN KEY (TeamId) REFERENCES auth.Teams(Id),
    CONSTRAINT FK_TeamMembers_User  FOREIGN KEY (UserId) REFERENCES auth.Users(Id)
);
GO

PRINT '✓ auth tables created.';
GO
