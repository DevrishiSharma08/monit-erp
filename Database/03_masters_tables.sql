-- ============================================================
-- FILE : 03_masters_tables.sql
-- DESC : All master / lookup tables
--        Mills, Materials, Customers, Salesmen,
--        Warehouses, Transporters, Sizes, Categories, Rates
-- RUN  : After 02_auth_tables.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ============================================================
-- SECTION 1 : MILL MASTERS
-- ============================================================

-- ------------------------------------------------------------
-- masters.Mills
-- Paper mills that supply material to Monit Paper Agency.
-- ------------------------------------------------------------
IF OBJECT_ID('masters.Mills', 'U') IS NULL
CREATE TABLE masters.Mills (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    Code            NVARCHAR(20)    NOT NULL,           -- Short code: BALT, JK, ITC
    Name            NVARCHAR(200)   NOT NULL,
    OwnerName       NVARCHAR(200)   NULL,
    Phone           NVARCHAR(20)    NULL,
    Email           NVARCHAR(200)   NULL,
    IsActive        BIT             NOT NULL    DEFAULT 1,

    CreatedAt       DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy       NVARCHAR(100)   NOT NULL,
    UpdatedAt       DATETIME2       NULL,
    UpdatedBy       NVARCHAR(100)   NULL,
    IsDeleted       BIT             NOT NULL    DEFAULT 0,
    DeletedAt       DATETIME2       NULL,
    DeletedBy       NVARCHAR(100)   NULL,

    CONSTRAINT PK_Mills         PRIMARY KEY (Id),
    CONSTRAINT UQ_Mills_Code    UNIQUE (Code)
);
GO

-- ------------------------------------------------------------
-- masters.MillUnits
-- Optional production units per mill (Silvassa Unit, Raipur Unit…).
-- ------------------------------------------------------------
IF OBJECT_ID('masters.MillUnits', 'U') IS NULL
CREATE TABLE masters.MillUnits (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    MillId      INT             NOT NULL,
    UnitName    NVARCHAR(200)   NOT NULL,
    Address     NVARCHAR(500)   NULL,
    IsActive    BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_MillUnits         PRIMARY KEY (Id),
    CONSTRAINT FK_MillUnits_Mill    FOREIGN KEY (MillId) REFERENCES masters.Mills(Id)
);
GO

-- ------------------------------------------------------------
-- masters.MillContacts
-- Contacts per unit. Designation: Owner/Purchaser/Accountant/Sales.
-- ------------------------------------------------------------
IF OBJECT_ID('masters.MillContacts', 'U') IS NULL
CREATE TABLE masters.MillContacts (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    MillUnitId      INT             NOT NULL,
    ContactPerson   NVARCHAR(200)   NOT NULL,
    Designation     NVARCHAR(50)    NULL,           -- Owner / Purchaser / Accountant / Sales
    Phone           NVARCHAR(20)    NULL,
    Email           NVARCHAR(200)   NULL,
    IsActive        BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_MillContacts              PRIMARY KEY (Id),
    CONSTRAINT FK_MillContacts_MillUnit     FOREIGN KEY (MillUnitId) REFERENCES masters.MillUnits(Id)
);
GO

-- ============================================================
-- SECTION 2 : MATERIAL CLASSIFICATION
-- ============================================================

-- ------------------------------------------------------------
-- masters.StockGroups
-- Top-level grouping: Printing Paper, Writing Paper, etc.
-- ------------------------------------------------------------
-- ------------------------------------------------------------
-- masters.StockGroups  (Quality Master — groups like ITC, Pearl)
-- ------------------------------------------------------------
IF OBJECT_ID('masters.StockGroups', 'U') IS NULL
CREATE TABLE masters.StockGroups (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    Name        NVARCHAR(200)   NOT NULL,
    Description NVARCHAR(500)   NULL,
    IsActive    BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_StockGroups   PRIMARY KEY (Id)
);
GO

-- ------------------------------------------------------------
-- masters.StockSubGroups  (Qualities within a group)
-- ------------------------------------------------------------
IF OBJECT_ID('masters.StockSubGroups', 'U') IS NULL
CREATE TABLE masters.StockSubGroups (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    StockGroupId    INT             NOT NULL,
    Name            NVARCHAR(200)   NOT NULL,
    IsDeleted       BIT             NOT NULL    DEFAULT 0,
    CreatedAt       DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy       NVARCHAR(100)   NOT NULL,

    CONSTRAINT PK_StockSubGroups            PRIMARY KEY (Id),
    CONSTRAINT FK_StockSubGroups_Group      FOREIGN KEY (StockGroupId) REFERENCES masters.StockGroups(Id)
);
GO

-- ------------------------------------------------------------
-- masters.StockCategories  (GSM Master — single GSM or range)
-- ------------------------------------------------------------
IF OBJECT_ID('masters.StockCategories', 'U') IS NULL
CREATE TABLE masters.StockCategories (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    Code        NVARCHAR(20)    NOT NULL,           -- Auto-generated: "200" or "200-400"
    Name        NVARCHAR(100)   NOT NULL,           -- "200 GSM" or "200-400 GSM"
    GsmType     NVARCHAR(10)    NOT NULL    DEFAULT 'single',  -- single / range
    Gsm         INT             NULL,
    GsmMin      INT             NULL,
    GsmMax      INT             NULL,
    IsActive    BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_StockCategories       PRIMARY KEY (Id),
    CONSTRAINT UQ_StockCategories_Code  UNIQUE (Code)
);
GO

-- ------------------------------------------------------------
-- masters.ItemTypes
-- Physical form of the material: Ream, Roll, Sheet, etc.
-- ------------------------------------------------------------
IF OBJECT_ID('masters.ItemTypes', 'U') IS NULL
CREATE TABLE masters.ItemTypes (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    Code        NVARCHAR(20)    NOT NULL,
    Name        NVARCHAR(100)   NOT NULL,
    Description NVARCHAR(300)   NULL,
    IsActive    BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_ItemTypes         PRIMARY KEY (Id),
    CONSTRAINT UQ_ItemTypes_Code    UNIQUE (Code)
);
GO

-- ------------------------------------------------------------
-- masters.PaperSizes
-- Standard and custom paper sizes: A4, 23x36, etc.
-- ------------------------------------------------------------
IF OBJECT_ID('masters.PaperSizes', 'U') IS NULL
CREATE TABLE masters.PaperSizes (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    Label       NVARCHAR(50)    NOT NULL,       -- "23x36", "A4"
    WidthMM     INT             NULL,
    HeightMM    INT             NULL,
    IsCustom    BIT             NOT NULL    DEFAULT 0,
    SortOrder   INT             NOT NULL    DEFAULT 0,
    IsActive    BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_PaperSizes        PRIMARY KEY (Id),
    CONSTRAINT UQ_PaperSizes_Label  UNIQUE (Label)
);
GO

-- ------------------------------------------------------------
-- masters.Materials  (Item Master)
-- One row = one specific paper item.
-- Code auto-composed: {MillCode}/{Quality}/{GSM}/{Type}/{Size}
--   e.g.  ITC/COTE/80/SHEET/72x100   ITC/COTE/80/REEL/72
-- Packing hierarchy stored for SO/PO auto-calculation:
--   Sheet  = base unit | Packet = SheetsPerPacket
--   Bundle = SheetsPerPacket + PacketsPerBundle
--   Box    = all three
-- Sheet weight (kg) = GSM x SizeLength x SizeWidth / 10^7
-- ------------------------------------------------------------
IF OBJECT_ID('masters.Materials', 'U') IS NULL
CREATE TABLE masters.Materials (
    Id               INT             IDENTITY(1,1)   NOT NULL,
    Code             NVARCHAR(150)   NOT NULL,       -- Auto-composed, unique
    MillId           INT             NOT NULL,
    QualityId        INT             NOT NULL,       -- StockSubGroups
    ItemTypeId       INT             NOT NULL,       -- ItemTypes (Reel / Sheet)
    GSM              INT             NOT NULL,
    SizeLength       DECIMAL(10,2)   NOT NULL,       -- cm; Reel=width, Sheet=length
    SizeWidth        DECIMAL(10,2)   NULL,           -- cm; NULL for Reel
    PackingType      NVARCHAR(20)    NOT NULL        DEFAULT 'Sheet',
    SheetsPerPacket  INT             NULL,
    PacketsPerBundle INT             NULL,
    BundlesPerBox    INT             NULL,
    Description      NVARCHAR(500)   NULL,
    IsActive         BIT             NOT NULL        DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Materials          PRIMARY KEY (Id),
    CONSTRAINT UQ_Materials_Code     UNIQUE (Code),
    CONSTRAINT FK_Materials_Mill     FOREIGN KEY (MillId)     REFERENCES masters.Mills(Id),
    CONSTRAINT FK_Materials_Quality  FOREIGN KEY (QualityId)  REFERENCES masters.StockSubGroups(Id),
    CONSTRAINT FK_Materials_ItemType FOREIGN KEY (ItemTypeId) REFERENCES masters.ItemTypes(Id)
);
GO

-- ------------------------------------------------------------
-- masters.Units  (Unit Master — kg, ream, roll, etc.)
-- ------------------------------------------------------------
IF OBJECT_ID('masters.Units', 'U') IS NULL
CREATE TABLE masters.Units (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    Name        NVARCHAR(100)   NOT NULL,
    Description NVARCHAR(300)   NULL,
    IsActive    BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Units PRIMARY KEY (Id)
);
GO

-- ------------------------------------------------------------
-- masters.MillQualityGsm  (MQG Master)
-- Defines valid Mill + Quality + GSM Range + Type combinations.
-- Used as a lookup key in Rate Master for sale/purchase rates.
-- Code auto-generated: {MillCode}-{QualityName}-{GsmMin}-{GsmMax}-{Type}
-- ------------------------------------------------------------
IF OBJECT_ID('masters.MillQualityGsm', 'U') IS NULL
CREATE TABLE masters.MillQualityGsm (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    Code        NVARCHAR(100)   NOT NULL,           -- e.g. ITC-CLASSICOTE-70-90-REEL
    MillId      INT             NOT NULL,
    QualityId   INT             NOT NULL,           -- → masters.StockSubGroups
    GsmMin      INT             NOT NULL,
    GsmMax      INT             NOT NULL,
    [Type]      NVARCHAR(20)    NOT NULL,           -- Reel / Sheet
    IsActive    BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_MillQualityGsm            PRIMARY KEY (Id),
    CONSTRAINT UQ_MillQualityGsm_Code       UNIQUE (Code),
    CONSTRAINT UQ_MillQualityGsm_Combo      UNIQUE (MillId, QualityId, GsmMin, GsmMax, [Type]),
    CONSTRAINT FK_MillQualityGsm_Mill       FOREIGN KEY (MillId)    REFERENCES masters.Mills(Id),
    CONSTRAINT FK_MillQualityGsm_Quality    FOREIGN KEY (QualityId) REFERENCES masters.StockSubGroups(Id)
);
GO

-- ============================================================
-- SECTION 3 : CUSTOMER MASTER
-- ============================================================

-- ------------------------------------------------------------
-- masters.Customers
-- ------------------------------------------------------------
IF OBJECT_ID('masters.Customers', 'U') IS NULL
CREATE TABLE masters.Customers (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    Name            NVARCHAR(200)   NOT NULL,
    OwnerName       NVARCHAR(200)   NULL,
    Phone           NVARCHAR(20)    NULL,
    Email           NVARCHAR(200)   NULL,
    GSTNo           NVARCHAR(20)    NULL,
    BillingAddress  NVARCHAR(500)   NULL,
    CreditLimit     DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    CreditDays      INT             NOT NULL    DEFAULT 0,
    IsActive        BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Customers PRIMARY KEY (Id)
);
GO

-- ------------------------------------------------------------
-- masters.CustomerContacts
-- Multiple contacts per customer.
-- ------------------------------------------------------------
IF OBJECT_ID('masters.CustomerContacts', 'U') IS NULL
CREATE TABLE masters.CustomerContacts (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    CustomerId      INT             NOT NULL,
    Name            NVARCHAR(200)   NOT NULL,
    Phone           NVARCHAR(20)    NULL,
    Email           NVARCHAR(200)   NULL,
    Designation     NVARCHAR(100)   NULL,
    IsPrimary       BIT             NOT NULL    DEFAULT 0,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_CustomerContacts          PRIMARY KEY (Id),
    CONSTRAINT FK_CustomerContacts_Customer FOREIGN KEY (CustomerId)
                                            REFERENCES masters.Customers(Id)
);
GO

-- ------------------------------------------------------------
-- masters.CustomerDeliveryLocations
-- ------------------------------------------------------------
IF OBJECT_ID('masters.CustomerDeliveryLocations', 'U') IS NULL
CREATE TABLE masters.CustomerDeliveryLocations (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    CustomerId  INT             NOT NULL,
    Label       NVARCHAR(100)   NULL,               -- optional: "Factory", "Warehouse"
    Address     NVARCHAR(500)   NOT NULL,
    IsDefault   BIT             NOT NULL    DEFAULT 0,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_CustomerDeliveryLocations          PRIMARY KEY (Id),
    CONSTRAINT FK_CustomerDeliveryLocations_Customer FOREIGN KEY (CustomerId)
                                                     REFERENCES masters.Customers(Id)
);
GO

-- ============================================================
-- SECTION 4 : SALESMEN
-- ============================================================

IF OBJECT_ID('masters.Salesmen', 'U') IS NULL
CREATE TABLE masters.Salesmen (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    Code        NVARCHAR(20)    NOT NULL,
    Name        NVARCHAR(200)   NOT NULL,
    Phone       NVARCHAR(20)    NULL,
    Email       NVARCHAR(200)   NULL,
    Territory   NVARCHAR(200)   NULL,
    UserId      INT             NULL,   -- Link to auth.Users (optional)
    IsActive    BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Salesmen          PRIMARY KEY (Id),
    CONSTRAINT UQ_Salesmen_Code     UNIQUE (Code),
    CONSTRAINT FK_Salesmen_User     FOREIGN KEY (UserId) REFERENCES auth.Users(Id)
);
GO

-- ============================================================
-- SECTION 5 : WAREHOUSE MASTER
-- ============================================================

-- ------------------------------------------------------------
-- masters.Warehouses
-- ------------------------------------------------------------
IF OBJECT_ID('masters.Warehouses', 'U') IS NULL
CREATE TABLE masters.Warehouses (
    Id      INT             IDENTITY(1,1)   NOT NULL,
    Unit    NVARCHAR(200)   NOT NULL,           -- location/unit name
    Name    NVARCHAR(200)   NOT NULL,
    IsActive BIT            NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Warehouses PRIMARY KEY (Id)
);
GO

-- ------------------------------------------------------------
-- masters.WarehouseBins  (e.g. Bin "A", Bin "B")
-- ------------------------------------------------------------
IF OBJECT_ID('masters.WarehouseBins', 'U') IS NULL
CREATE TABLE masters.WarehouseBins (
    Id          INT             IDENTITY(1,1)   NOT NULL,
    WarehouseId INT             NOT NULL,
    Name        NVARCHAR(50)    NOT NULL,           -- "A", "B"
    IsActive    BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_WarehouseBins     PRIMARY KEY (Id),
    CONSTRAINT FK_WarehouseBins_WH  FOREIGN KEY (WarehouseId) REFERENCES masters.Warehouses(Id)
);
GO

-- ------------------------------------------------------------
-- masters.WarehouseRacks  (e.g. Rack "A1", "A2" within Bin "A")
-- StackCount = how many stack positions exist in this rack.
-- Stock is placed at Warehouse > Bin > Rack > Stack# (1..StackCount).
-- ------------------------------------------------------------
IF OBJECT_ID('masters.WarehouseRacks', 'U') IS NULL
CREATE TABLE masters.WarehouseRacks (
    Id         INT             IDENTITY(1,1)   NOT NULL,
    BinId      INT             NOT NULL,
    Name       NVARCHAR(50)    NOT NULL,           -- "A1", "A2"
    StackCount INT             NOT NULL    DEFAULT 1,
    IsActive   BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_WarehouseRacks    PRIMARY KEY (Id),
    CONSTRAINT FK_WarehouseRacks_Bin FOREIGN KEY (BinId) REFERENCES masters.WarehouseBins(Id)
);
GO

-- ============================================================
-- SECTION 6 : TRANSPORTER MASTER
-- ============================================================

IF OBJECT_ID('masters.Transporters', 'U') IS NULL
CREATE TABLE masters.Transporters (
    Id      INT             IDENTITY(1,1)   NOT NULL,
    Name    NVARCHAR(200)   NOT NULL,
    Phone   NVARCHAR(20)    NULL,
    Email   NVARCHAR(200)   NULL,
    Address NVARCHAR(500)   NULL,
    IsActive BIT            NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Transporters PRIMARY KEY (Id)
);
GO

-- ------------------------------------------------------------
-- masters.TransporterVehicles
-- ------------------------------------------------------------
IF OBJECT_ID('masters.TransporterVehicles', 'U') IS NULL
CREATE TABLE masters.TransporterVehicles (
    Id            INT             IDENTITY(1,1)   NOT NULL,
    TransporterId INT             NOT NULL,
    VehicleType   NVARCHAR(50)    NOT NULL,           -- Truck / Mini Truck / Tempo
    Capacity      DECIMAL(10,2)   NULL,
    CapacityUnit  NVARCHAR(20)    NULL,               -- kg / Ton / MT
    FreightRate   DECIMAL(18,4)   NULL,               -- rate per trip / MT
    IsActive      BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_TransporterVehicles        PRIMARY KEY (Id),
    CONSTRAINT FK_TransporterVehicles_Transp FOREIGN KEY (TransporterId)
                                             REFERENCES masters.Transporters(Id)
);
GO

-- ============================================================
-- SECTION 7 : RATE MASTER
-- ============================================================

-- ------------------------------------------------------------
-- masters.Rates
-- Sale and purchase rates keyed by MQG (Mill/Quality/GSM range).
-- RateType : 'Sale' | 'Purchase'
-- RateCategory : NULL for Sale | 'Self' (Monit's own) | 'Customer' (per-customer) for Purchase
-- CustomerId : NULL = universal; set for customer-specific rates
-- Records are INSERT-ONLY — always insert new row, never mutate Rate value.
-- Current rate = latest EffectiveFrom per (MQGId, RateType, RateCategory, CustomerId).
-- ------------------------------------------------------------
IF OBJECT_ID('masters.Rates', 'U') IS NULL
CREATE TABLE masters.Rates (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    MQGId           INT             NOT NULL,
    RateType        NVARCHAR(10)    NOT NULL,       -- 'Sale' / 'Purchase'
    RateCategory    NVARCHAR(10)    NULL,           -- NULL for Sale | 'Self' / 'Customer' for Purchase
    CustomerId      INT             NULL,
    Rate            DECIMAL(18,4)   NOT NULL,
    EffectiveFrom   DATE            NOT NULL,
    IsActive        BIT             NOT NULL    DEFAULT 1,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Rates          PRIMARY KEY (Id),
    CONSTRAINT FK_Rates_MQG      FOREIGN KEY (MQGId)     REFERENCES masters.MillQualityGsm(Id),
    CONSTRAINT FK_Rates_Customer FOREIGN KEY (CustomerId) REFERENCES masters.Customers(Id)
);
GO

PRINT '✓ masters tables created.';
GO
