-- ============================================================
-- FILE : 04_sales_tables.sql
-- DESC : Sales flow — Inquiries → Sales Orders → Lines
-- RUN  : After 03_masters_tables.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ------------------------------------------------------------
-- sales.Inquiries
-- A customer's interest in buying material.
-- Can be converted to a Sales Order via the app.
-- InquiryNumber format: INQ-2024-0001
-- ------------------------------------------------------------
IF OBJECT_ID('sales.Inquiries', 'U') IS NULL
CREATE TABLE sales.Inquiries (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    InquiryNumber   NVARCHAR(20)    NOT NULL,           -- INQ-2024-0001 (from NumberSequences)
    CustomerId      INT             NOT NULL,
    ContactPerson   NVARCHAR(200)   NULL,
    Phone           NVARCHAR(20)    NULL,
    Email           NVARCHAR(200)   NULL,
    [Source]        NVARCHAR(50)    NULL,               -- Phone / WhatsApp / Email / Visit
    SalesmanId      INT             NULL,
    Priority        NVARCHAR(20)    NOT NULL    DEFAULT 'Medium', -- Low / Medium / High / Urgent
    [Status]        NVARCHAR(50)    NOT NULL    DEFAULT 'Draft',
    -- Draft → Stock Checked → Mill Confirmed → Converted → Closed
    Remarks         NVARCHAR(1000)  NULL,
    ConvertedToSOId INT             NULL,               -- Set when converted
    ConvertedAt     DATETIME2       NULL,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_Inquiries             PRIMARY KEY (Id),
    CONSTRAINT UQ_Inquiries_Number      UNIQUE (InquiryNumber),
    CONSTRAINT FK_Inquiries_Customer    FOREIGN KEY (CustomerId)    REFERENCES masters.Customers(Id),
    CONSTRAINT FK_Inquiries_Salesman    FOREIGN KEY (SalesmanId)    REFERENCES masters.Salesmen(Id)
    -- FK_Inquiries_SO added after sales.SalesOrders is created
);
GO

-- ------------------------------------------------------------
-- sales.InquiryRequirements
-- Line items of an inquiry — each line is one material need.
-- ------------------------------------------------------------
IF OBJECT_ID('sales.InquiryRequirements', 'U') IS NULL
CREATE TABLE sales.InquiryRequirements (
    Id                  INT             IDENTITY(1,1)   NOT NULL,
    InquiryId           INT             NOT NULL,
    MaterialId          INT             NOT NULL,
    Quantity            DECIMAL(18,4)   NOT NULL,
    Unit                NVARCHAR(10)    NOT NULL    DEFAULT 'Sheet',  -- Sheet / KG
    RequiredDeliveryDate DATE           NULL,
    DeliveryLocation    NVARCHAR(500)   NULL,
    Urgency             NVARCHAR(20)    NOT NULL    DEFAULT 'Normal', -- Normal / Urgent / Critical
    CoverageStatus      NVARCHAR(50)    NULL,
    AllocatedQty        DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    MillConfirmedQty    DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    Remarks             NVARCHAR(500)   NULL,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_InquiryRequirements           PRIMARY KEY (Id),
    CONSTRAINT FK_InquiryRequirements_Inquiry   FOREIGN KEY (InquiryId)
                                                REFERENCES sales.Inquiries(Id),
    CONSTRAINT FK_InquiryRequirements_Material  FOREIGN KEY (MaterialId)
                                                REFERENCES masters.Materials(Id)
);
GO

-- ------------------------------------------------------------
-- sales.SalesOrders
-- Confirmed order from customer. Status follows a forward-only
-- state machine — no going back once order is dispatched.
-- SONumber format: SO-2024-0001
-- ------------------------------------------------------------
IF OBJECT_ID('sales.SalesOrders', 'U') IS NULL
CREATE TABLE sales.SalesOrders (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    SONumber        NVARCHAR(20)    NOT NULL,           -- SO-2024-0001
    CustomerId      INT             NOT NULL,
    ContactPerson   NVARCHAR(200)   NULL,
    SalesmanId      INT             NULL,
    OrderDate       DATE            NOT NULL,
    [Status]        NVARCHAR(50)    NOT NULL    DEFAULT 'Draft',
    -- Draft → Coverage Pending → Partially Allocated → Fully Allocated
    -- → In Dispatch → Partially Delivered → Completed → Closed / Cancelled
    PaymentTerms    NVARCHAR(50)    NULL,               -- 30 Days / 45 Days / Advance / Against Delivery
    DeliveryTerms   NVARCHAR(200)   NULL,
    DeliveryMode    NVARCHAR(50)    NULL,               -- From Stock / Direct Mill Delivery / Mixed
    TotalValue      DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    Remarks         NVARCHAR(1000)  NULL,
    InquiryId       INT             NULL,               -- Source inquiry (optional)
    InvoiceNumber   NVARCHAR(50)    NULL,               -- Filled in Phase 2 after invoicing

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_SalesOrders               PRIMARY KEY (Id),
    CONSTRAINT UQ_SalesOrders_Number        UNIQUE (SONumber),
    CONSTRAINT FK_SalesOrders_Customer      FOREIGN KEY (CustomerId)
                                            REFERENCES masters.Customers(Id),
    CONSTRAINT FK_SalesOrders_Salesman      FOREIGN KEY (SalesmanId)
                                            REFERENCES masters.Salesmen(Id),
    CONSTRAINT FK_SalesOrders_Inquiry       FOREIGN KEY (InquiryId)
                                            REFERENCES sales.Inquiries(Id)
);
GO

-- Now we can add the FK from Inquiries → SalesOrders
ALTER TABLE sales.Inquiries
    ADD CONSTRAINT FK_Inquiries_SO
    FOREIGN KEY (ConvertedToSOId) REFERENCES sales.SalesOrders(Id);
GO

-- ------------------------------------------------------------
-- sales.SalesOrderLines
-- Each line = one material, quantity, rate, delivery info.
-- AllocatedQty, PendingQty, InvoicedQty are updated by the app
-- as stock is allocated, dispatched, and invoiced.
-- ------------------------------------------------------------
IF OBJECT_ID('sales.SalesOrderLines', 'U') IS NULL
CREATE TABLE sales.SalesOrderLines (
    Id                      INT             IDENTITY(1,1)   NOT NULL,
    SOId                    INT             NOT NULL,
    LineNumber              INT             NOT NULL,       -- 1, 2, 3 ...
    MaterialId              INT             NOT NULL,
    Description             NVARCHAR(500)   NULL,           -- Denormalized for display
    GSM                     INT             NULL,
    Size                    NVARCHAR(50)    NULL,
    Quantity                DECIMAL(18,4)   NOT NULL,
    Unit                    NVARCHAR(10)    NULL    DEFAULT 'Sheet',
    Rate                    DECIMAL(18,4)   NULL,
    Amount                  DECIMAL(18,4)   NULL,
    DeliveryDate            DATE            NULL,
    DeliveryLocationId      INT             NULL,           -- → CustomerDeliveryLocations
    AllocatedQty            DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    PendingQty              DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    InvoicedQty             DECIMAL(18,4)   NOT NULL    DEFAULT 0,  -- Phase 2

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_SalesOrderLines               PRIMARY KEY (Id),
    CONSTRAINT UQ_SalesOrderLines               UNIQUE (SOId, LineNumber),
    CONSTRAINT FK_SalesOrderLines_SO            FOREIGN KEY (SOId)
                                                REFERENCES sales.SalesOrders(Id),
    CONSTRAINT FK_SalesOrderLines_Material      FOREIGN KEY (MaterialId)
                                                REFERENCES masters.Materials(Id),
    CONSTRAINT FK_SalesOrderLines_Location      FOREIGN KEY (DeliveryLocationId)
                                                REFERENCES masters.CustomerDeliveryLocations(Id)
);
GO

PRINT '✓ sales tables created.';
GO
