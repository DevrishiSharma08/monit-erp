-- ============================================================
-- FILE : 05_procurement_tables.sql
-- DESC : Procurement flow — Purchase Orders, Mill Trackers,
--        history logs, partial deliveries
-- RUN  : After 04_sales_tables.sql
-- ============================================================

USE MonitPaperDB;
GO

-- ------------------------------------------------------------
-- procurement.PurchaseOrders
-- Orders placed with mills to procure paper.
-- Can be against a Sales Order (Against SO), for general
-- stock (For Stock), or mixed.
-- PONumber format: PO-2024-0001
-- ------------------------------------------------------------
IF OBJECT_ID('procurement.PurchaseOrders', 'U') IS NULL
CREATE TABLE procurement.PurchaseOrders (
    Id                      INT             IDENTITY(1,1)   NOT NULL,
    PONumber                NVARCHAR(20)    NOT NULL,           -- PO-2024-0001
    MillId                  INT             NOT NULL,
    OrderDate               DATE            NOT NULL,
    POType                  NVARCHAR(30)    NOT NULL,           -- Against SO / For Stock / Mixed
    LinkedSOId              INT             NULL,               -- When POType = Against SO
    DeliveryMode            NVARCHAR(30)    NULL,               -- Direct To Customer / To Godown
    DirectCustomerId        INT             NULL,               -- For direct delivery POs
    DirectDeliveryAddress   NVARCHAR(500)   NULL,
    BlindShipment           BIT             NOT NULL    DEFAULT 0,
    -- Blind shipment: mill does not see customer name on PO
    ExpectedDispatchDate    DATE            NULL,
    ExpectedDeliveryDate    DATE            NULL,
    PaymentTerms            NVARCHAR(50)    NULL,
    FreightType             NVARCHAR(20)    NULL,               -- To Pay / Included
    TotalQuantity           DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    TotalValue              DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    [Status]                NVARCHAR(50)    NOT NULL    DEFAULT 'Draft',
    -- Draft → Sent to Mill → Acknowledged → In Production
    -- → Partial Ready → Ready → Dispatched → In Transit
    -- → Part Received → Completed
    TallyLedgerName         NVARCHAR(200)   NULL,           -- Phase 2 Tally integration
    PurchaseLedgerGroup     NVARCHAR(200)   NULL,
    GSTPercentage           DECIMAL(5,2)    NULL,
    Remarks                 NVARCHAR(1000)  NULL,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_PurchaseOrders            PRIMARY KEY (Id),
    CONSTRAINT UQ_PurchaseOrders_Number     UNIQUE (PONumber),
    CONSTRAINT FK_PurchaseOrders_Mill       FOREIGN KEY (MillId)
                                            REFERENCES masters.Mills(Id),
    CONSTRAINT FK_PurchaseOrders_SO         FOREIGN KEY (LinkedSOId)
                                            REFERENCES sales.SalesOrders(Id),
    CONSTRAINT FK_PurchaseOrders_Customer   FOREIGN KEY (DirectCustomerId)
                                            REFERENCES masters.Customers(Id)
);
GO

-- ------------------------------------------------------------
-- procurement.PurchaseOrderItems
-- Line items of a PO. Each line maps to one material.
-- LinkedSOLineId ties a PO item back to a specific SO line
-- so coverage can be tracked.
-- ------------------------------------------------------------
IF OBJECT_ID('procurement.PurchaseOrderItems', 'U') IS NULL
CREATE TABLE procurement.PurchaseOrderItems (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    POId            INT             NOT NULL,
    LineNumber      INT             NOT NULL,
    MaterialId      INT             NOT NULL,
    Description     NVARCHAR(500)   NULL,
    GSM             INT             NULL,
    Size            NVARCHAR(50)    NULL,
    Quantity        DECIMAL(18,4)   NOT NULL,
    Unit            NVARCHAR(10)    NULL    DEFAULT 'Sheet',
    Rate            DECIMAL(18,4)   NULL,
    Amount          DECIMAL(18,4)   NULL,
    ReceivedQty     DECIMAL(18,4)   NOT NULL    DEFAULT 0,  -- Updated on GRN creation
    PendingQty      DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    LinkedSOLineId  INT             NULL,           -- → sales.SalesOrderLines

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_PurchaseOrderItems            PRIMARY KEY (Id),
    CONSTRAINT UQ_PurchaseOrderItems            UNIQUE (POId, LineNumber),
    CONSTRAINT FK_PurchaseOrderItems_PO         FOREIGN KEY (POId)
                                                REFERENCES procurement.PurchaseOrders(Id),
    CONSTRAINT FK_PurchaseOrderItems_Material   FOREIGN KEY (MaterialId)
                                                REFERENCES masters.Materials(Id),
    CONSTRAINT FK_PurchaseOrderItems_SOLine     FOREIGN KEY (LinkedSOLineId)
                                                REFERENCES sales.SalesOrderLines(Id)
);
GO

-- ------------------------------------------------------------
-- procurement.MillTrackers
-- Tracks production progress of each PO item at the mill.
-- One tracker row per PO item (or per PO if no items yet).
-- DelayDays is a computed column — auto-calculated from today.
-- BalanceQty = OrderedQty - DispatchedQty (computed).
-- ------------------------------------------------------------
IF OBJECT_ID('procurement.MillTrackers', 'U') IS NULL
CREATE TABLE procurement.MillTrackers (
    Id                  INT             IDENTITY(1,1)   NOT NULL,
    POId                INT             NOT NULL,
    POItemId            INT             NULL,           -- NULL = whole PO level tracker
    MillId              INT             NOT NULL,
    PODate              DATE            NULL,
    MaterialId          INT             NOT NULL,
    OrderedQty          DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    ReadyQty            DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    DispatchedQty       DECIMAL(18,4)   NOT NULL    DEFAULT 0,
    BalanceQty          AS (OrderedQty - DispatchedQty) PERSISTED,
    Rate                DECIMAL(18,4)   NULL,
    TotalAmount         DECIMAL(18,4)   NULL,
    ProductionStatus    NVARCHAR(50)    NOT NULL    DEFAULT 'Order Placed',
    -- Order Placed → In Production → Partial Ready → Ready
    -- → Dispatched → Delayed / Cancelled
    ProductionProgress  DECIMAL(5,2)    NOT NULL    DEFAULT 0,  -- % 0-100
    ExpectedDelivery    DATE            NULL,
    ActualDispatchDate  DATE            NULL,
    LastUpdate          DATETIME2       NULL,
    LastUpdatedBy       NVARCHAR(100)   NULL,
    DelayDays           AS (
                            CASE
                                WHEN ExpectedDelivery IS NOT NULL
                                 AND ProductionStatus NOT IN ('Ready','Dispatched','Cancelled')
                                THEN DATEDIFF(day, ExpectedDelivery, GETDATE())
                                ELSE 0
                            END
                        ),  -- Not persisted — always fresh
    LinkedSOId          INT             NULL,
    DeliveryMode        NVARCHAR(30)    NULL,
    MillInvoiceNo       NVARCHAR(50)    NULL,
    CustomerName        NVARCHAR(200)   NULL,           -- Denormalized for quick display
    CustomerId          INT             NULL,
    Remarks             NVARCHAR(1000)  NULL,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_MillTrackers              PRIMARY KEY (Id),
    CONSTRAINT FK_MillTrackers_PO           FOREIGN KEY (POId)
                                            REFERENCES procurement.PurchaseOrders(Id),
    CONSTRAINT FK_MillTrackers_POItem       FOREIGN KEY (POItemId)
                                            REFERENCES procurement.PurchaseOrderItems(Id),
    CONSTRAINT FK_MillTrackers_Mill         FOREIGN KEY (MillId)
                                            REFERENCES masters.Mills(Id),
    CONSTRAINT FK_MillTrackers_Material     FOREIGN KEY (MaterialId)
                                            REFERENCES masters.Materials(Id),
    CONSTRAINT FK_MillTrackers_SO           FOREIGN KEY (LinkedSOId)
                                            REFERENCES sales.SalesOrders(Id),
    CONSTRAINT FK_MillTrackers_Customer     FOREIGN KEY (CustomerId)
                                            REFERENCES masters.Customers(Id)
);
GO

-- ------------------------------------------------------------
-- procurement.MillTrackerHistory
-- Immutable log of every status change on a tracker.
-- Never updated — only inserted (append-only audit trail).
-- ------------------------------------------------------------
IF OBJECT_ID('procurement.MillTrackerHistory', 'U') IS NULL
CREATE TABLE procurement.MillTrackerHistory (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    TrackerId       INT             NOT NULL,
    [Status]        NVARCHAR(50)    NOT NULL,
    Note            NVARCHAR(1000)  NULL,
    UpdatedBy       NVARCHAR(100)   NOT NULL,
    UpdatedAt       DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    ReadyQty        DECIMAL(18,4)   NULL,
    DispatchedQty   DECIMAL(18,4)   NULL,

    -- No UpdatedAt/IsDeleted — this is an immutable audit log
    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,

    CONSTRAINT PK_MillTrackerHistory            PRIMARY KEY (Id),
    CONSTRAINT FK_MillTrackerHistory_Tracker    FOREIGN KEY (TrackerId)
                                                REFERENCES procurement.MillTrackers(Id)
);
GO

-- ------------------------------------------------------------
-- procurement.MillTrackerPartialDeliveries
-- When a mill dispatches in batches, each batch is recorded here.
-- ------------------------------------------------------------
IF OBJECT_ID('procurement.MillTrackerPartialDeliveries', 'U') IS NULL
CREATE TABLE procurement.MillTrackerPartialDeliveries (
    Id              INT             IDENTITY(1,1)   NOT NULL,
    TrackerId       INT             NOT NULL,
    DeliveryDate    DATE            NOT NULL,
    Quantity        DECIMAL(18,4)   NOT NULL,
    LRNumber        NVARCHAR(50)    NULL,
    VehicleNumber   NVARCHAR(20)    NULL,
    Remarks         NVARCHAR(500)   NULL,

    CreatedAt   DATETIME2       NOT NULL    DEFAULT GETUTCDATE(),
    CreatedBy   NVARCHAR(100)   NOT NULL,
    UpdatedAt   DATETIME2       NULL,
    UpdatedBy   NVARCHAR(100)   NULL,
    IsDeleted   BIT             NOT NULL    DEFAULT 0,
    DeletedAt   DATETIME2       NULL,
    DeletedBy   NVARCHAR(100)   NULL,

    CONSTRAINT PK_MillTrackerPartialDeliveries          PRIMARY KEY (Id),
    CONSTRAINT FK_MillTrackerPartialDeliveries_Tracker  FOREIGN KEY (TrackerId)
                                                        REFERENCES procurement.MillTrackers(Id)
);
GO

PRINT '✓ procurement tables created.';
GO
