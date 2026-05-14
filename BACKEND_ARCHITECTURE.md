# Monit Paper Agency ERP — Backend Architecture Reference

**Created:** 2026-04-28 | **Updated:** 2026-04-28
**Stack:** .NET 8 Web API + Dapper + SQL Server (MSSQL)
**Pattern:** Clean Architecture (Domain → Application → Infrastructure → API)
**Purpose:** Single source of truth for all backend design decisions. Read before touching any backend code.

---

## 1. Context & Constraints

- **Phase 1 (current):** Procurement flow — Inquiry → SO → Coverage → PO → Mill Tracker → GRN → Stock → Pick Plan → TLP → Challan → In-Transit + all Masters + Auth
- **Phase 2 (future):** Invoicing (Sales + Purchase), Payments, Tally export, Customer portal
- **Phase 3 (future):** Full reporting dashboards, advanced analytics
- **Non-negotiable:** SO / PO / GRN data must survive all future phases without corruption — no destructive ALTER TABLE on core tables ever
- **Client:** Single company (Monit Paper Agency, Indore) — single-tenant

---

## 2. Technology Decisions

| Decision | Choice | Reason |
|---|---|---|
| Framework | .NET 8 Web API | LTS, performance, strong typing |
| Data Access | **Dapper** (micro-ORM) | Raw SQL control, high performance, no abstraction overhead |
| DB Tables | **SQL scripts** (manual, in `/database` folder) | Full control; no migration magic to debug |
| Database | SQL Server 2022 | Client familiarity, ACID, proper FK enforcement |
| Auth | JWT Bearer + Refresh Token | Stateless, React-compatible |
| Validation | FluentValidation | Cleaner than DataAnnotations at scale |
| Mapping | Mapster | Fast, no global static config |
| Logging | Serilog → file + console | Structured logs |
| API Docs | Swagger (Swashbuckle) | Auto-generated from code |
| Primary Key | `INT IDENTITY(1,1)` | Performance; display numbers (SO-2024-001) are separate varchar fields |
| Soft Delete | `IsDeleted BIT`, `DeletedAt`, `DeletedBy` on every table | Full audit trail; client data preservation requirement |
| Status Fields | `NVARCHAR(50)` NOT int | Readable in DB; adding new statuses = zero schema change |
| Amounts | `DECIMAL(18,4)` | Precision for paper weight/pricing |
| Dates | `DATETIME2` (store UTC) | No DST issues; frontend converts to IST |
| Phase 2/3 tables | **NOT created now** | Create only what Phase 1 needs; Phase 2 tables added via new scripts when work starts |

---

## 3. Solution Structure

```
Monit.sln
│
├── src/
│   ├── Monit.API/                        ← ASP.NET Core Web API (Presentation layer)
│   │   ├── Controllers/
│   │   │   ├── Auth/
│   │   │   ├── Masters/                  ← Mills, Materials, Customers, Salesmen, etc.
│   │   │   ├── Sales/                    ← Inquiries, SalesOrders, Coverage
│   │   │   ├── Procurement/              ← PurchaseOrders, MillTrackers
│   │   │   ├── Inventory/                ← GRNs, StockLots
│   │   │   ├── Logistics/                ← PickPlans, TLP, Challans, InTransit
│   │   │   └── System/                   ← Notifications, Health
│   │   ├── Middleware/
│   │   │   ├── ExceptionMiddleware.cs    ← Global exception → standard error response
│   │   │   └── RequestLoggingMiddleware.cs
│   │   ├── Filters/
│   │   │   └── ValidationFilter.cs       ← Auto-returns 400 on FluentValidation failure
│   │   ├── Extensions/
│   │   │   └── ServiceCollectionExtensions.cs
│   │   └── Program.cs
│   │
│   ├── Monit.Application/                ← Business logic — no SQL, no HTTP here
│   │   ├── Features/                     ← One sub-folder per feature/aggregate
│   │   │   ├── Auth/
│   │   │   │   ├── Commands/             ← LoginCommand, RefreshTokenCommand
│   │   │   │   ├── Queries/
│   │   │   │   └── DTOs/
│   │   │   ├── Inquiries/
│   │   │   │   ├── Commands/             ← CreateInquiry, UpdateInquiry, ConvertToSO, CheckCoverage
│   │   │   │   ├── Queries/              ← GetInquiries, GetInquiryById
│   │   │   │   └── DTOs/
│   │   │   ├── SalesOrders/
│   │   │   ├── Coverage/
│   │   │   ├── PurchaseOrders/
│   │   │   ├── MillTrackers/
│   │   │   ├── GRNs/
│   │   │   ├── StockLots/
│   │   │   ├── PickPlans/
│   │   │   ├── TruckLoadPlans/
│   │   │   ├── Challans/
│   │   │   ├── InTransit/
│   │   │   └── Masters/                  ← One Commands+Queries+DTOs per master type
│   │   ├── Common/
│   │   │   ├── Interfaces/
│   │   │   │   ├── IRepository.cs        ← Generic: GetById, GetAll, Add, Update, Delete
│   │   │   │   ├── IUnitOfWork.cs        ← Wraps SqlTransaction for multi-table ops
│   │   │   │   └── ICurrentUser.cs       ← Gets userId/role from JWT claims
│   │   │   ├── Models/
│   │   │   │   ├── ApiResponse.cs        ← Standard { success, data, message, errors, meta }
│   │   │   │   └── PagedResult.cs
│   │   │   ├── Validators/               ← FluentValidation base classes
│   │   │   └── Exceptions/               ← NotFoundException, ForbiddenException, ConflictException
│   │   └── Mappings/                     ← Mapster config (Entity ↔ DTO)
│   │
│   ├── Monit.Domain/                     ← Pure POCO models — ZERO external dependencies
│   │   ├── Entities/
│   │   │   ├── Base/
│   │   │   │   └── BaseEntity.cs         ← See section 4
│   │   │   ├── Auth/                     ← User, Role, Team, TeamMember
│   │   │   ├── Masters/                  ← Mill, Material, Customer, Salesman, etc.
│   │   │   ├── Sales/                    ← Inquiry, InquiryRequirement, SalesOrder, SalesOrderLine
│   │   │   ├── Procurement/              ← PurchaseOrder, PurchaseOrderItem, MillTracker, ...
│   │   │   ├── Inventory/                ← GRN, StockLot, StockAllocation, BinLocation
│   │   │   └── Logistics/                ← PickPlan, TruckLoadPlan, Challan, InTransitTracking
│   │   └── Enums/                        ← Minimal — only used in C# logic, not stored in DB
│   │
│   └── Monit.Infrastructure/             ← Dapper, SqlConnection, external services
│       ├── Data/
│       │   └── DbConnectionFactory.cs    ← Creates IDbConnection from connection string
│       ├── Repositories/
│       │   ├── GenericRepository.cs      ← Dapper-based generic CRUD
│       │   ├── Auth/
│       │   ├── Masters/
│       │   ├── Sales/
│       │   ├── Procurement/
│       │   ├── Inventory/
│       │   └── Logistics/
│       ├── Services/
│       │   ├── NumberSequenceService.cs  ← Thread-safe number gen: SO-2024-0001
│       │   ├── CoverageService.cs        ← Stock + in-transit coverage calculation
│       │   ├── PasswordService.cs        ← BCrypt hash/verify
│       │   └── CurrentUserService.cs     ← Reads JWT claims
│       └── DependencyInjection.cs        ← Registers all repos + services
│
└── database/                             ← ALL SQL scripts (run in order)
    ├── 00_schemas.sql                    ← CREATE SCHEMA for all schemas
    ├── 01_system_tables.sql              ← NumberSequences, AuditLogs, Notifications
    ├── 02_auth_tables.sql                ← Users, Roles, Teams, TeamMembers
    ├── 03_masters_tables.sql             ← All 14+ master tables
    ├── 04_sales_tables.sql               ← Inquiries, SalesOrders, SalesOrderLines
    ├── 05_procurement_tables.sql         ← PurchaseOrders, MillTrackers, History
    ├── 06_inventory_tables.sql           ← GRNs, StockLots, Allocations, BinLocations
    ├── 07_logistics_tables.sql           ← PickPlans, TLP, Challans, InTransit
    ├── 08_indexes.sql                    ← All non-PK indexes
    ├── 09_seed_data.sql                  ← NumberSequences seed + Admin user + sample masters
    └── _future/
        ├── phase2_finance_tables.sql     ← SalesInvoices, PurchaseInvoices, Payments (Phase 2)
        └── phase3_reporting_tables.sql   ← Aggregates, snapshots (Phase 3)
```

---

## 4. Base Entity (all C# domain models inherit this)

```csharp
public abstract class BaseEntity
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
}
```

Every SQL table has these columns. Repositories always add `WHERE IsDeleted = 0` in SELECT queries. Delete operations set `IsDeleted = 1, DeletedAt = GETUTCDATE(), DeletedBy = @user` — never hard delete.

---

## 5. Database Schema — Phase 1 Only

SQL Server schemas for logical isolation:

| Schema | Tables | Purpose |
|---|---|---|
| `system` | NumberSequences, AuditLogs, Notifications | Infrastructure / cross-cutting |
| `auth` | Users, Roles, Teams, TeamMembers | Authentication & authorization |
| `masters` | 14 tables | All lookup/master data |
| `sales` | Inquiries, InquiryRequirements, SalesOrders, SalesOrderLines | Customer-facing sales flow |
| `procurement` | PurchaseOrders, PurchaseOrderItems, MillTrackers, MillTrackerHistory, MillTrackerPartialDeliveries | Mill ordering flow |
| `inventory` | GRNs, StockLots, StockAllocations, PurchaseAllocations, BinLocations | Warehouse stock |
| `logistics` | PickPlans, PickPlanLines, TruckLoadPlans, TruckLoadPlanItems, Challans, ChallanLines, InTransitTrackings | Dispatch & delivery |

---

### 5.1 system schema

```sql
system.NumberSequences
  Id INT IDENTITY PK,
  Module NVARCHAR(20) NOT NULL,      -- INQ / SO / PO / GRN / TLP / PP / CHN / TRK
  Year INT NOT NULL,
  LastNumber INT NOT NULL DEFAULT 0,
  CONSTRAINT UQ_NumSeq UNIQUE (Module, Year)

system.AuditLogs
  Id INT IDENTITY PK,
  TableName NVARCHAR(100), RecordId INT,
  Action NVARCHAR(10),               -- INSERT / UPDATE / DELETE
  OldValues NVARCHAR(MAX),           -- JSON
  NewValues NVARCHAR(MAX),           -- JSON
  ChangedBy NVARCHAR(100), ChangedAt DATETIME2

system.Notifications
  Id INT IDENTITY PK,
  Type NVARCHAR(20),                 -- SO / PO / GRN / TLP / MILL
  Title NVARCHAR(200), Body NVARCHAR(500),
  RefId INT, RefNumber NVARCHAR(50), HRef NVARCHAR(200),
  UserId INT NULL FK→auth.Users,     -- NULL = all users
  IsRead BIT DEFAULT 0, ReadAt DATETIME2 NULL,
  [BaseEntity cols]
```

### 5.2 auth schema

```sql
auth.Users
  Id INT IDENTITY PK,
  Username NVARCHAR(100) UNIQUE NOT NULL,
  Email NVARCHAR(200) UNIQUE,
  PasswordHash NVARCHAR(500) NOT NULL,
  Name NVARCHAR(200) NOT NULL,
  Role NVARCHAR(50) NOT NULL,          -- Admin/Manager/Salesman/Planner/Accounts/Warehouse Manager
  CustomerName NVARCHAR(200) NULL,     -- Only for Customer-role users (Phase 2)
  IsActive BIT DEFAULT 1,
  LastLoginAt DATETIME2 NULL,
  RefreshToken NVARCHAR(500) NULL,
  RefreshTokenExpiry DATETIME2 NULL,
  [BaseEntity cols]

auth.Roles
  Id INT IDENTITY PK,
  Name NVARCHAR(100) UNIQUE NOT NULL,
  Description NVARCHAR(500),
  Permissions NVARCHAR(MAX),           -- JSON array of permission strings
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

auth.Teams
  Id INT IDENTITY PK,
  Name NVARCHAR(200) NOT NULL,
  Description NVARCHAR(500),
  ManagerId INT FK→auth.Users,
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

auth.TeamMembers
  Id INT IDENTITY PK,
  TeamId INT FK→auth.Teams NOT NULL,
  UserId INT FK→auth.Users NOT NULL,
  JoinedAt DATETIME2,
  [BaseEntity cols]
```

### 5.3 masters schema

```sql
masters.Mills
  Id INT IDENTITY PK,
  Code NVARCHAR(20) UNIQUE NOT NULL,
  Name NVARCHAR(200) NOT NULL,
  City NVARCHAR(100), State NVARCHAR(100),
  ContactPerson NVARCHAR(200), Phone NVARCHAR(20), Email NVARCHAR(200),
  GSTNo NVARCHAR(20), PAN NVARCHAR(20),
  PaymentTerms NVARCHAR(50), FreightType NVARCHAR(50),
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.MillContacts
  Id INT IDENTITY PK,
  MillId INT FK→masters.Mills NOT NULL,
  Name NVARCHAR(200), Phone NVARCHAR(20), Email NVARCHAR(200),
  Role NVARCHAR(100), IsPrimary BIT DEFAULT 0,
  [BaseEntity cols]

masters.MillUnits
  Id INT IDENTITY PK,
  MillId INT FK→masters.Mills NOT NULL,
  UnitName NVARCHAR(200), City NVARCHAR(100), State NVARCHAR(100),
  ContactPerson NVARCHAR(200), Phone NVARCHAR(20),
  [BaseEntity cols]

masters.StockGroups
  Id INT IDENTITY PK,
  Code NVARCHAR(20) UNIQUE NOT NULL,
  Name NVARCHAR(100) NOT NULL,
  Description NVARCHAR(500),
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.StockCategories
  Id INT IDENTITY PK,
  StockGroupId INT FK→masters.StockGroups NOT NULL,
  Code NVARCHAR(20) UNIQUE NOT NULL,
  Name NVARCHAR(100) NOT NULL,
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.ItemTypes
  Id INT IDENTITY PK,
  Code NVARCHAR(20) UNIQUE NOT NULL,
  Name NVARCHAR(100) NOT NULL,
  Description NVARCHAR(500),
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.PaperSizes
  Id INT IDENTITY PK,
  Label NVARCHAR(50) UNIQUE NOT NULL,
  WidthMM INT, HeightMM INT,
  IsCustom BIT DEFAULT 0,
  SortOrder INT DEFAULT 0,
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.Materials
  Id INT IDENTITY PK,
  Code NVARCHAR(100) UNIQUE NOT NULL,  -- Auto: MillCode-CategoryCode-GSM-SizeLabel-Packing
  MillId INT FK→masters.Mills NOT NULL,
  CategoryId INT FK→masters.StockCategories NOT NULL,
  ItemTypeId INT FK→masters.ItemTypes,
  StockGroupId INT FK→masters.StockGroups,
  GSM INT NOT NULL,
  SizeId INT FK→masters.PaperSizes NOT NULL,
  PackingType NVARCHAR(50),
  Description NVARCHAR(500),
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.Customers
  Id INT IDENTITY PK,
  Code NVARCHAR(20) UNIQUE NOT NULL,
  CompanyName NVARCHAR(200) NOT NULL,
  ContactPerson NVARCHAR(200),
  Phone NVARCHAR(20), Email NVARCHAR(200),
  GSTNo NVARCHAR(20), PAN NVARCHAR(20),
  TallyLedgerName NVARCHAR(200),
  OfficeAddress NVARCHAR(500), City NVARCHAR(100), State NVARCHAR(100),
  PaymentTerms NVARCHAR(50),
  CreditLimit DECIMAL(18,4) DEFAULT 0,
  CreditDays INT DEFAULT 0,
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.CustomerContacts
  Id INT IDENTITY PK,
  CustomerId INT FK→masters.Customers NOT NULL,
  Name NVARCHAR(200) NOT NULL, Phone NVARCHAR(20), Email NVARCHAR(200),
  Designation NVARCHAR(100), IsPrimary BIT DEFAULT 0,
  [BaseEntity cols]

masters.CustomerDeliveryLocations
  Id INT IDENTITY PK,
  CustomerId INT FK→masters.Customers NOT NULL,
  Label NVARCHAR(100), Address NVARCHAR(500),
  City NVARCHAR(100), State NVARCHAR(100), Pincode NVARCHAR(10),
  GSTNo NVARCHAR(20), IsDefault BIT DEFAULT 0,
  [BaseEntity cols]

masters.Salesmen
  Id INT IDENTITY PK,
  Code NVARCHAR(20) UNIQUE NOT NULL,
  Name NVARCHAR(200) NOT NULL,
  Phone NVARCHAR(20), Email NVARCHAR(200), Territory NVARCHAR(200),
  UserId INT FK→auth.Users NULL,
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.Warehouses
  Id INT IDENTITY PK,
  Code NVARCHAR(20) UNIQUE NOT NULL,
  Name NVARCHAR(200) NOT NULL,
  Address NVARCHAR(500), City NVARCHAR(100),
  Manager NVARCHAR(200), Phone NVARCHAR(20),
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.WarehouseBins
  Id INT IDENTITY PK,
  WarehouseId INT FK→masters.Warehouses NOT NULL,
  BinCode NVARCHAR(20) NOT NULL,
  Row NVARCHAR(10), Col NVARCHAR(10), Level NVARCHAR(10),
  Capacity INT DEFAULT 0, IsActive BIT DEFAULT 1,
  CONSTRAINT UQ_Bin UNIQUE (WarehouseId, BinCode),
  [BaseEntity cols]

masters.Transporters
  Id INT IDENTITY PK,
  Code NVARCHAR(20) UNIQUE NOT NULL,
  Name NVARCHAR(200) NOT NULL,
  ContactPerson NVARCHAR(200), Phone NVARCHAR(20), Email NVARCHAR(200),
  GSTNo NVARCHAR(20), PAN NVARCHAR(20),
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.TransporterVehicles
  Id INT IDENTITY PK,
  TransporterId INT FK→masters.Transporters NOT NULL,
  VehicleNumber NVARCHAR(20) NOT NULL,
  Type NVARCHAR(50), CapacityKg DECIMAL(10,2),
  DriverName NVARCHAR(200), DriverPhone NVARCHAR(20),
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]

masters.Rates
  Id INT IDENTITY PK,
  MaterialId INT FK→masters.Materials NOT NULL,
  CustomerId INT FK→masters.Customers NULL,   -- NULL = standard rate
  MillId INT FK→masters.Mills NULL,            -- NULL = not mill-specific
  RateType NVARCHAR(20) NOT NULL,              -- Standard/Client-Wise/Mill-Wise/Direct
  SaleRate DECIMAL(18,4),
  PurchaseRate DECIMAL(18,4),
  EffectiveFrom DATE NOT NULL,
  EffectiveTo DATE NULL,
  IsActive BIT DEFAULT 1,
  [BaseEntity cols]
```

### 5.4 sales schema

```sql
sales.Inquiries
  Id INT IDENTITY PK,
  InquiryNumber NVARCHAR(20) UNIQUE NOT NULL,  -- INQ-2024-0001
  CustomerId INT FK→masters.Customers NOT NULL,
  ContactPerson NVARCHAR(200), Phone NVARCHAR(20), Email NVARCHAR(200),
  Source NVARCHAR(50),                          -- Phone/WhatsApp/Email/Visit
  SalesmanId INT FK→masters.Salesmen,
  Priority NVARCHAR(20) DEFAULT 'Medium',       -- Low/Medium/High/Urgent
  Status NVARCHAR(50) DEFAULT 'Draft',          -- Draft/Stock Checked/Mill Confirmed/Converted/Closed
  Remarks NVARCHAR(1000),
  ConvertedToSOId INT FK→sales.SalesOrders NULL,
  ConvertedAt DATETIME2 NULL,
  [BaseEntity cols]

sales.InquiryRequirements
  Id INT IDENTITY PK,
  InquiryId INT FK→sales.Inquiries NOT NULL,
  MaterialId INT FK→masters.Materials NOT NULL,
  Quantity DECIMAL(18,4) NOT NULL,
  Unit NVARCHAR(10) DEFAULT 'Sheet',            -- Sheet/KG
  RequiredDeliveryDate DATE,
  DeliveryLocation NVARCHAR(500),
  Urgency NVARCHAR(20) DEFAULT 'Normal',        -- Normal/Urgent/Critical
  CoverageStatus NVARCHAR(50),
  AllocatedQty DECIMAL(18,4) DEFAULT 0,
  MillConfirmedQty DECIMAL(18,4) DEFAULT 0,
  Remarks NVARCHAR(500),
  [BaseEntity cols]

sales.SalesOrders
  Id INT IDENTITY PK,
  SONumber NVARCHAR(20) UNIQUE NOT NULL,        -- SO-2024-0001
  CustomerId INT FK→masters.Customers NOT NULL,
  ContactPerson NVARCHAR(200),
  SalesmanId INT FK→masters.Salesmen,
  OrderDate DATE NOT NULL,
  Status NVARCHAR(50) DEFAULT 'Draft',
  -- Draft/Coverage Pending/Partially Allocated/Fully Allocated/
  -- In Dispatch/Partially Delivered/Completed/Closed/Cancelled
  PaymentTerms NVARCHAR(50),
  DeliveryTerms NVARCHAR(200),
  DeliveryMode NVARCHAR(50),                    -- From Stock/Direct Mill Delivery/Mixed
  TotalValue DECIMAL(18,4) DEFAULT 0,
  Remarks NVARCHAR(1000),
  InquiryId INT FK→sales.Inquiries NULL,
  InvoiceNumber NVARCHAR(50) NULL,              -- Filled in Phase 2
  [BaseEntity cols]

sales.SalesOrderLines
  Id INT IDENTITY PK,
  SOId INT FK→sales.SalesOrders NOT NULL,
  LineNumber INT NOT NULL,
  MaterialId INT FK→masters.Materials NOT NULL,
  Description NVARCHAR(500),
  GSM INT, Size NVARCHAR(50),
  Quantity DECIMAL(18,4) NOT NULL,
  Unit NVARCHAR(10),
  Rate DECIMAL(18,4), Amount DECIMAL(18,4),
  DeliveryDate DATE,
  DeliveryLocationId INT FK→masters.CustomerDeliveryLocations NULL,
  AllocatedQty DECIMAL(18,4) DEFAULT 0,
  PendingQty DECIMAL(18,4) DEFAULT 0,
  InvoicedQty DECIMAL(18,4) DEFAULT 0,
  [BaseEntity cols]
```

### 5.5 procurement schema

```sql
procurement.PurchaseOrders
  Id INT IDENTITY PK,
  PONumber NVARCHAR(20) UNIQUE NOT NULL,        -- PO-2024-0001
  MillId INT FK→masters.Mills NOT NULL,
  OrderDate DATE NOT NULL,
  POType NVARCHAR(30) NOT NULL,                 -- Against SO/For Stock/Mixed
  LinkedSOId INT FK→sales.SalesOrders NULL,
  DeliveryMode NVARCHAR(30),                    -- Direct To Customer/To Godown
  DirectCustomerId INT FK→masters.Customers NULL,
  DirectDeliveryAddress NVARCHAR(500),
  BlindShipment BIT DEFAULT 0,
  ExpectedDispatchDate DATE, ExpectedDeliveryDate DATE,
  PaymentTerms NVARCHAR(50), FreightType NVARCHAR(20),
  TotalQuantity DECIMAL(18,4) DEFAULT 0,
  TotalValue DECIMAL(18,4) DEFAULT 0,
  Status NVARCHAR(50) DEFAULT 'Draft',
  -- Draft/Sent to Mill/Acknowledged/In Production/
  -- Partial Ready/Ready/Dispatched/In Transit/Part Received/Completed
  TallyLedgerName NVARCHAR(200),
  PurchaseLedgerGroup NVARCHAR(200),
  GSTPercentage DECIMAL(5,2),
  Remarks NVARCHAR(1000),
  [BaseEntity cols]

procurement.PurchaseOrderItems
  Id INT IDENTITY PK,
  POId INT FK→procurement.PurchaseOrders NOT NULL,
  LineNumber INT NOT NULL,
  MaterialId INT FK→masters.Materials NOT NULL,
  Description NVARCHAR(500),
  GSM INT, Size NVARCHAR(50),
  Quantity DECIMAL(18,4) NOT NULL,
  Unit NVARCHAR(10),
  Rate DECIMAL(18,4), Amount DECIMAL(18,4),
  ReceivedQty DECIMAL(18,4) DEFAULT 0,
  PendingQty DECIMAL(18,4) DEFAULT 0,
  LinkedSOLineId INT FK→sales.SalesOrderLines NULL,
  [BaseEntity cols]

procurement.MillTrackers
  Id INT IDENTITY PK,
  POId INT FK→procurement.PurchaseOrders NOT NULL,
  POItemId INT FK→procurement.PurchaseOrderItems NULL,
  MillId INT FK→masters.Mills NOT NULL,
  PODate DATE,
  MaterialId INT FK→masters.Materials NOT NULL,
  OrderedQty DECIMAL(18,4), ReadyQty DECIMAL(18,4) DEFAULT 0,
  DispatchedQty DECIMAL(18,4) DEFAULT 0,
  BalanceQty AS (OrderedQty - DispatchedQty),   -- Computed column
  Rate DECIMAL(18,4), TotalAmount DECIMAL(18,4),
  ProductionStatus NVARCHAR(50) DEFAULT 'Order Placed',
  -- Order Placed/In Production/Partial Ready/Ready/Dispatched/Delayed/Cancelled
  ProductionProgress DECIMAL(5,2) DEFAULT 0,    -- %
  ExpectedDelivery DATE,
  ActualDispatchDate DATE NULL,
  LastUpdate DATETIME2, LastUpdatedBy NVARCHAR(100),
  DelayDays AS DATEDIFF(day, ExpectedDelivery, GETDATE()),  -- Computed
  LinkedSOId INT FK→sales.SalesOrders NULL,
  DeliveryMode NVARCHAR(30),
  MillInvoiceNo NVARCHAR(50),
  CustomerName NVARCHAR(200),
  CustomerId INT FK→masters.Customers NULL,
  Remarks NVARCHAR(1000),
  [BaseEntity cols]

procurement.MillTrackerHistory
  Id INT IDENTITY PK,
  TrackerId INT FK→procurement.MillTrackers NOT NULL,
  Status NVARCHAR(50), Note NVARCHAR(1000),
  UpdatedBy NVARCHAR(100), UpdatedAt DATETIME2,
  ReadyQty DECIMAL(18,4), DispatchedQty DECIMAL(18,4),
  [BaseEntity cols]

procurement.MillTrackerPartialDeliveries
  Id INT IDENTITY PK,
  TrackerId INT FK→procurement.MillTrackers NOT NULL,
  DeliveryDate DATE, Quantity DECIMAL(18,4),
  LRNumber NVARCHAR(50), VehicleNumber NVARCHAR(20),
  Remarks NVARCHAR(500),
  [BaseEntity cols]
```

### 5.6 inventory schema

```sql
inventory.GRNs
  Id INT IDENTITY PK,
  GRNNumber NVARCHAR(20) UNIQUE NOT NULL,       -- GRN-2024-0001
  GRNDate DATE NOT NULL,
  POId INT FK→procurement.PurchaseOrders NOT NULL,
  PONumber NVARCHAR(20),
  PurchaseInvoiceNumber NVARCHAR(50),
  MillChallanNumber NVARCHAR(50),
  MillId INT FK→masters.Mills NOT NULL,
  MaterialId INT FK→masters.Materials NOT NULL,
  GSM INT, SizeId INT FK→masters.PaperSizes,
  OrderedQty DECIMAL(18,4), PreviouslyReceivedQty DECIMAL(18,4) DEFAULT 0,
  ReceivedQty DECIMAL(18,4) NOT NULL,
  ShortQty DECIMAL(18,4) DEFAULT 0,
  DamagedQty DECIMAL(18,4) DEFAULT 0,
  BalanceQty DECIMAL(18,4) DEFAULT 0,
  ReceivedWeightMT DECIMAL(10,4), ExpectedWeightMT DECIMAL(10,4),
  WarehouseId INT FK→masters.Warehouses,
  BinLocationId INT FK→masters.WarehouseBins,
  SuggestedBin NVARCHAR(20),
  Condition NVARCHAR(30),                       -- Good/Slight Damage/Wet/Torn/Mixed GSM
  QCResult NVARCHAR(50),                        -- Accepted/Accepted with Remark/Rejected/Hold
  QualityGrade NVARCHAR(20),                    -- A Grade/B Grade/Rejected
  LotNumber NVARCHAR(100) UNIQUE NOT NULL,      -- Auto: MillCode-PaperCode-GSM-Size-Date-Seq
  LRNumber NVARCHAR(50),
  TransporterId INT FK→masters.Transporters NULL,
  VehicleNumber NVARCHAR(20), DriverName NVARCHAR(200),
  FreightAmount DECIMAL(18,4) DEFAULT 0,
  UnloadingCharges DECIMAL(18,4) DEFAULT 0,
  InvoiceEligible BIT DEFAULT 1,
  Remarks NVARCHAR(1000),
  [BaseEntity cols]

inventory.StockLots
  Id INT IDENTITY PK,
  LotNumber NVARCHAR(100) UNIQUE NOT NULL,
  GRNId INT FK→inventory.GRNs NOT NULL,
  MaterialId INT FK→masters.Materials NOT NULL,
  MillId INT FK→masters.Mills NOT NULL,
  GSM INT, SizeId INT FK→masters.PaperSizes,
  WarehouseId INT FK→masters.Warehouses,
  BinLocationId INT FK→masters.WarehouseBins,
  GRNDate DATE NOT NULL,                        -- Used for FIFO ordering
  OpeningQty DECIMAL(18,4) NOT NULL,
  CurrentQty DECIMAL(18,4) NOT NULL,
  ReservedQty DECIMAL(18,4) DEFAULT 0,
  AvailableQty AS (CurrentQty - ReservedQty),   -- Computed
  CostPerUnit DECIMAL(18,4), TotalCost DECIMAL(18,4),
  Condition NVARCHAR(30), QualityGrade NVARCHAR(20),
  Status NVARCHAR(30) DEFAULT 'Available',
  -- Available/Partially Allocated/Fully Allocated/Exhausted/Blocked
  FIFOSequence INT NOT NULL,                    -- Lower = picked first
  [BaseEntity cols]

inventory.StockAllocations
  Id INT IDENTITY PK,
  StockLotId INT FK→inventory.StockLots NOT NULL,
  SOLineId INT FK→sales.SalesOrderLines NOT NULL,
  SOId INT FK→sales.SalesOrders NOT NULL,
  AllocatedQty DECIMAL(18,4) NOT NULL,
  AllocationType NVARCHAR(30),
  Status NVARCHAR(30) DEFAULT 'Pending',        -- Pending/Confirmed/Dispatched/Cancelled
  [BaseEntity cols]

inventory.PurchaseAllocations
  Id INT IDENTITY PK,
  POItemId INT FK→procurement.PurchaseOrderItems NOT NULL,
  SOLineId INT FK→sales.SalesOrderLines NOT NULL,
  AllocatedQty DECIMAL(18,4) NOT NULL,
  Status NVARCHAR(30) DEFAULT 'Pending',
  [BaseEntity cols]

inventory.BinLocations
  Id INT IDENTITY PK,
  WarehouseId INT FK→masters.Warehouses NOT NULL,
  BinCode NVARCHAR(20) NOT NULL,
  Row NVARCHAR(10), Col NVARCHAR(10), Level NVARCHAR(10),
  CurrentCapacity INT DEFAULT 0,
  MaxCapacity INT DEFAULT 0,
  Status NVARCHAR(20) DEFAULT 'Empty',          -- Empty/Partial/Full
  LastActivity DATETIME2,
  [BaseEntity cols]
```

### 5.7 logistics schema

```sql
logistics.PickPlans
  Id INT IDENTITY PK,
  PlanNumber NVARCHAR(20) UNIQUE NOT NULL,      -- PP-2024-0001
  PlanDate DATE NOT NULL,
  SOId INT FK→sales.SalesOrders NOT NULL,
  Status NVARCHAR(20) DEFAULT 'Draft',          -- Draft/Confirmed/Picked/Cancelled
  TotalLines INT DEFAULT 0,
  Remarks NVARCHAR(500),
  [BaseEntity cols]

logistics.PickPlanLines
  Id INT IDENTITY PK,
  PickPlanId INT FK→logistics.PickPlans NOT NULL,
  LineNumber INT NOT NULL,
  StockLotId INT FK→inventory.StockLots NOT NULL,
  BinLocationId INT FK→masters.WarehouseBins,
  MaterialId INT FK→masters.Materials,
  SOLineId INT FK→sales.SalesOrderLines,
  PickQty DECIMAL(18,4) NOT NULL,
  PickedQty DECIMAL(18,4) DEFAULT 0,
  FIFOSequence INT,
  Status NVARCHAR(30) DEFAULT 'Pending',
  [BaseEntity cols]

logistics.TruckLoadPlans
  Id INT IDENTITY PK,
  PlanNumber NVARCHAR(20) UNIQUE NOT NULL,      -- TLP-2024-0001
  PlanDate DATE NOT NULL,
  VehicleId INT FK→masters.TransporterVehicles NULL,
  TruckNumber NVARCHAR(20), DriverName NVARCHAR(200), DriverPhone NVARCHAR(20),
  TransporterId INT FK→masters.Transporters,
  TruckCapacityKg DECIMAL(10,2),
  Origin NVARCHAR(200),
  DeliveryMode NVARCHAR(30),                    -- Direct To Customer/To Godown/Multi-Stop
  PlannedLoadDate DATE, PlannedDeliveryDate DATE,
  ActualLoadDate DATE NULL, ActualDeliveryDate DATE NULL,
  Status NVARCHAR(20) DEFAULT 'Planned',        -- Planned/Loading/In Transit/Delivered
  InTransitTrackerId INT FK→logistics.InTransitTrackings NULL,
  [BaseEntity cols]

logistics.TruckLoadPlanItems
  Id INT IDENTITY PK,
  TLPId INT FK→logistics.TruckLoadPlans NOT NULL,
  LineNumber INT NOT NULL,
  POId INT FK→procurement.PurchaseOrders NULL,
  POItemId INT FK→procurement.PurchaseOrderItems NULL,
  MaterialId INT FK→masters.Materials,
  GSM INT, Size NVARCHAR(50),
  Quantity DECIMAL(18,4), WeightKg DECIMAL(10,2),
  PickPlanLineId INT FK→logistics.PickPlanLines NULL,
  StockLotId INT FK→inventory.StockLots NULL,
  CustomerId INT FK→masters.Customers,
  DeliveryAddress NVARCHAR(500),
  [BaseEntity cols]

logistics.Challans
  Id INT IDENTITY PK,
  ChallanNumber NVARCHAR(20) UNIQUE NOT NULL,   -- CHN-2024-0001
  ChallanDate DATE NOT NULL,
  TLPId INT FK→logistics.TruckLoadPlans NULL,
  SOId INT FK→sales.SalesOrders NULL,
  CustomerId INT FK→masters.Customers NOT NULL,
  DeliveryAddressId INT FK→masters.CustomerDeliveryLocations NULL,
  TransporterId INT FK→masters.Transporters,
  VehicleNumber NVARCHAR(20), DriverName NVARCHAR(200), DriverPhone NVARCHAR(20),
  LRNumber NVARCHAR(50),
  TotalQuantity DECIMAL(18,4), TotalWeightKg DECIMAL(10,2), TotalValue DECIMAL(18,4),
  Status NVARCHAR(20) DEFAULT 'Draft',          -- Draft/Issued/Delivered/Cancelled
  EWayBillNumber NVARCHAR(50),
  Remarks NVARCHAR(1000),
  [BaseEntity cols]

logistics.ChallanLines
  Id INT IDENTITY PK,
  ChallanId INT FK→logistics.Challans NOT NULL,
  LineNumber INT NOT NULL,
  MaterialId INT FK→masters.Materials,
  GSM INT, Size NVARCHAR(50),
  Quantity DECIMAL(18,4), WeightKg DECIMAL(10,2),
  Rate DECIMAL(18,4), Amount DECIMAL(18,4),
  StockLotId INT FK→inventory.StockLots NULL,
  [BaseEntity cols]

logistics.InTransitTrackings
  Id INT IDENTITY PK,
  TrackingNumber NVARCHAR(20) UNIQUE NOT NULL,  -- TRK-2024-0001
  TLPId INT FK→logistics.TruckLoadPlans NULL,
  TransporterId INT FK→masters.Transporters,
  VehicleNumber NVARCHAR(20), DriverName NVARCHAR(200), DriverPhone NVARCHAR(20),
  Origin NVARCHAR(200), Destination NVARCHAR(200),
  DispatchDateTime DATETIME2,
  ExpectedArrival DATETIME2, ActualArrival DATETIME2 NULL,
  CurrentStatus NVARCHAR(30) DEFAULT 'Dispatched',
  -- Dispatched/On Route/Reached/Delivered/Delayed
  CurrentLocation NVARCHAR(200), LastLocationUpdate DATETIME2,
  LRNumber NVARCHAR(50),
  TotalQuantity DECIMAL(18,4), TotalWeightKg DECIMAL(10,2),
  DelayHours INT DEFAULT 0, DelayReason NVARCHAR(500),
  Remarks NVARCHAR(1000),
  [BaseEntity cols]
```

---

## 6. API Design Conventions

### Base URL
```
/api/v1/{module}/{resource}
```

### Standard Response Envelope
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "errors": [],
  "meta": { "page": 1, "pageSize": 50, "total": 245, "totalPages": 5 }
}
```

### Standard List Query Parameters
```
?page=1&pageSize=50&search=abc&sortBy=createdAt&sortOrder=desc&status=Active&fromDate=2024-01-01&toDate=2024-12-31
```

### Controller → Route Mapping
| Controller | Base Route |
|---|---|
| AuthController | `/api/v1/auth` |
| Mills/Materials/Customers/etc. | `/api/v1/masters/{resource}` |
| InquiriesController | `/api/v1/sales/inquiries` |
| SalesOrdersController | `/api/v1/sales/orders` |
| CoverageController | `/api/v1/sales/coverage` |
| PurchaseOrdersController | `/api/v1/procurement/purchase-orders` |
| MillTrackersController | `/api/v1/procurement/mill-trackers` |
| GRNsController | `/api/v1/inventory/grns` |
| StockLotsController | `/api/v1/inventory/stock-lots` |
| PickPlansController | `/api/v1/logistics/pick-plans` |
| TruckLoadPlansController | `/api/v1/logistics/tlp` |
| ChallansController | `/api/v1/logistics/challans` |
| InTransitController | `/api/v1/logistics/in-transit` |
| NotificationsController | `/api/v1/system/notifications` |

### HTTP Verbs
- `GET /resource` — paginated list
- `GET /resource/{id}` — single record
- `POST /resource` — create
- `PUT /resource/{id}` — full update
- `PATCH /resource/{id}/status` — status transition only
- `DELETE /resource/{id}` — soft delete
- `POST /resource/{id}/action` — business actions (convert-to-so, check-coverage, send-to-mill…)

---

## 7. Key Business Logic

### Thread-safe Number Generation
```sql
-- Stored procedure using UPDLOCK to prevent duplicates
BEGIN TRAN
  UPDATE system.NumberSequences WITH (UPDLOCK)
  SET LastNumber = LastNumber + 1
  WHERE Module = @Module AND Year = @Year
  SELECT LastNumber FROM system.NumberSequences WHERE Module = @Module AND Year = @Year
COMMIT
-- Returns: SO-2024-0042
```

### Coverage Calculation
```
Available = SUM(StockLots.AvailableQty) WHERE MaterialId = X AND Status != 'Blocked'
In-Transit = SUM(TruckLoadPlanItems.Quantity) WHERE MaterialId = X
             AND TLP.Status IN ('Planned','Loading','In Transit')
Coverage % = (Available + In-Transit) / SOLine.Quantity * 100
```

### FIFO Picking Rule
- ORDER BY GRNDate ASC, BinCode ASC
- Never pick from `Status IN ('Blocked','Exhausted')`
- Partial picks allowed — split lot quantity

### Status Transition Rules
- SO / PO: forward-only after certain points (no reverting to Draft once sent)
- GRN: immutable after creation (corrections = new GRN)
- StockLot.Status: only system/service sets it, never direct API

---

## 8. Auth Configuration

```
JWT:
  Issuer: monit-erp-api
  Audience: monit-erp-frontend
  AccessTokenExpiry: 8 hours
  RefreshTokenExpiry: 7 days

CORS:
  Dev:  http://localhost:3000
  Prod: https://monit-erp.com

Role permissions matrix:
  Admin           → full access
  Manager         → all read + create/update, no hard-delete
  Salesman        → Inquiry + SO (own) + read-only rest
  Planner         → PO + TLP + PickPlan + Challan
  Accounts        → Finance (Phase 2) + read-only rest
  Warehouse Mgr   → GRN + Stock + BinLocations
```

---

## 9. Phase 1 Execution Plan

### Step 1 — Solution + DB (Day 1-2)
1. `dotnet new sln -n Monit` + 4 projects
2. Install Dapper, Serilog, FluentValidation, Mapster, Swashbuckle, Microsoft.Data.SqlClient
3. Write and run SQL scripts `00` → `09` — creates complete Phase 1 schema
4. `DbConnectionFactory.cs` + base `GenericRepository.cs` using Dapper
5. `NumberSequenceService.cs` with UPDLOCK stored procedure

### Step 2 — Auth (Day 2-3)
6. `POST /api/v1/auth/login` → JWT + refresh token
7. `POST /api/v1/auth/refresh`
8. `POST /api/v1/auth/logout`
9. Role-based `[Authorize]` attributes

### Step 3 — Masters APIs (Day 3-5)
10. CRUD for all 14 masters (Mills, Materials, Customers, Salesmen, Warehouses, Bins, Transporters, Vehicles, Sizes, StockGroups, StockCategories, ItemTypes, Rates, Users)
11. Material code auto-composition
12. Test each master with frontend

### Step 4 — Core Flow: Sales side (Day 5-7)
13. Inquiries CRUD + `check-coverage` action + `convert-to-so` action
14. Sales Orders CRUD + status patch + line management
15. Coverage engine (query)

### Step 5 — Core Flow: Procurement side (Day 7-9)
16. Purchase Orders CRUD + `send-to-mill` + `acknowledge` actions
17. Mill Trackers CRUD + history + `update-production-status`

### Step 6 — Inventory (Day 9-11)
18. GRN CRUD + lot number auto-generation + stock lot creation trigger
19. Stock Lots — FIFO list, bin assignment
20. Stock Allocations — allocate against SO line

### Step 7 — Logistics (Day 11-13)
21. Pick Plans CRUD + FIFO auto-generation
22. Truck Load Plans CRUD + loading confirmation
23. Challans CRUD + issue action
24. In-Transit CRUD + status updates

### Step 8 — Integration (Day 13-15)
25. Notifications API (list, mark-read, dismiss)
26. Connect frontend — replace mock data module by module
27. Integration testing + error handling
28. Deploy to IIS / staging server

---

## 10. Files Reference

| File | Purpose |
|---|---|
| `BACKEND_ARCHITECTURE.md` | This file — architecture, DB schema, patterns, plan |
| `BACKEND_REQUIREMENTS.md` | Screen-by-screen API contracts (request/response JSON shapes) |
| `CLAUDE.md` | Frontend codebase guidance |
| `frontend/data/mockData.ts` | TypeScript interfaces — match these when designing DTO shapes |
| `database/*.sql` | Run these in order to create the DB (does not exist yet — to be created) |
