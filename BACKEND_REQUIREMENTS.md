# Monit Paper Agency ERP — Backend Requirements & Implementation Guide

**Last Updated:** 2026-05-19
**Purpose:** Screen-wise documentation of frontend implementation and backend API contracts

> **Integration status as of 2026-05-19:**
> ✅ Implemented: Auth, All Masters, Sales Orders, Purchase Orders, Mill Tracker, Truck Load Plans, GRN, Stock Lots, Company Config, Dashboard
> 🔲 Pending: Customer Inquiry, Coverage Engine, Pick Plan, Challan, In-Transit, Notifications, Reports

---

## 📋 Table of Contents

1. [Customer Inquiry](#1-customer-inquiry)
2. [Sales Orders](#2-sales-orders)
3. [Coverage Engine](#3-coverage-engine)
4. [Purchase Orders to Mill](#4-purchase-orders-to-mill)
5. [Mill Tracker](#5-mill-tracker)
6. [Stock Management](#6-stock-management)
7. [Dispatch Queue](#7-dispatch-queue)
8. [Pick Plan](#8-pick-plan)
9. [Challan & Loading](#9-challan--loading)
10. [Truck Load Plan](#10-truck-load-plan)
11. [In-Transit Tracking](#11-in-transit-tracking)
12. [GRN (Goods Receipt Note) — Inventory Entry Gate](#12-grn-goods-receipt-note--inventory-entry-gate)
13. [Master Data](#13-master-data)

---

## 1. Customer Inquiry

### Frontend Status: ✅ Fully Implemented

**Location:** `frontend/app/inquiry/page.tsx`, `frontend/components/forms/InquiryForm.tsx`

### Features Implemented:
- ✅ Multi-line inquiry form with material selection
- ✅ Coverage check against physical + transit stock
- ✅ Mill confirmation workflow
- ✅ Convert to Sales Order button
- ✅ Status tracking (Draft → Stock Checked → Mill Confirmed → Converted)
- ✅ Real-time coverage percentage display
- ✅ Priority levels (Low, Medium, High, Urgent)

### Backend APIs Needed:

#### POST `/api/inquiries`
Create new customer inquiry
```json
{
  "customer": "ABC Printers",
  "contactPerson": "Rajesh Kumar",
  "phone": "9876543210",
  "email": "rajesh@abc.com",
  "source": "Phone | WhatsApp | Email | Visit",
  "requirements": [
    {
      "materialId": "mat_001",
      "quantity": 5000,
      "unit": "Sheet | KG",
      "requiredDeliveryDate": "2026-03-01",
      "deliveryLocation": "Factory Address",
      "urgency": "Normal | Urgent | Critical"
    }
  ],
  "priority": "Medium",
  "salesman": "Amit Sharma"
}
```

**Response:**
```json
{
  "id": "inq_001",
  "inquiryNumber": "INQ-2026-0001",
  "status": "Draft",
  "createdAt": "2026-02-14T10:30:00Z"
}
```

#### POST `/api/inquiries/{id}/check-coverage`
Check stock coverage for inquiry items

**Request:**
```json
{
  "requirements": [
    {
      "materialId": "mat_001",
      "quantity": 5000
    }
  ]
}
```

**Response:**
```json
{
  "coverageResults": [
    {
      "materialId": "mat_001",
      "physicalStock": 3000,
      "transitStock": 1500,
      "totalAvailable": 4500,
      "required": 5000,
      "coveragePercentage": 90,
      "shortfall": 500,
      "millRequired": true,
      "suggestedMill": "ITC Paperboards",
      "alternatives": [
        {
          "materialId": "mat_002",
          "availableQty": 6000,
          "priceDiff": 50
        }
      ]
    }
  ],
  "overallCoverage": 90,
  "millConfirmationRequired": true
}
```

#### PATCH `/api/inquiries/{id}/status`
Update inquiry status

**Request:**
```json
{
  "status": "Stock Checked | Mill Confirmed | Converted | Lost",
  "remarks": "Customer confirmed price and delivery",
  "convertedToSO": "SO-2026-0001" // if status = Converted
}
```

#### POST `/api/inquiries/{id}/convert-to-so`
Convert inquiry to sales order

**Response:**
```json
{
  "soId": "so_001",
  "soNumber": "SO-2026-0001",
  "message": "Inquiry converted to Sales Order successfully"
}
```

### Business Logic Required:

1. **Auto-numbering:** Generate `INQ-YYYY-NNNN` format
2. **Coverage Calculation:**
   - Physical Stock = `SUM(stockLots.availableQty WHERE material = X)`
   - Transit Stock = `SUM(purchaseAllocations.qty WHERE status = 'In Transit' AND material = X)`
   - Coverage % = `((physicalStock + transitStock) / required) * 100`
3. **Mill Suggestion:**
   - If coverage < 100%, suggest mill based on:
     - Material specialty
     - Lead time
     - Historical performance
     - Current load
4. **Status Transition Rules:**
   - Draft → Stock Checked (after coverage check)
   - Stock Checked → Mill Confirmed (after mill confirmation)
   - Mill Confirmed → Converted (when SO created)
   - Any status → Lost (if customer rejects)

---

## 2. Sales Orders

### Frontend Status: ✅ Fully Implemented

**Location:** `frontend/app/orders/page.tsx`, `frontend/components/forms/SalesOrderForm.tsx`

### Features Implemented:
- ✅ Multi-line order form with material master dropdown
- ✅ Real-time total amount calculation
- ✅ Coverage summary panel (physical, transit, purchase allocations)
- ✅ Delivery mode per line (From Stock, Direct Mill, Mixed)
- ✅ Line-level delivery addresses and dates
- ✅ Status lifecycle tracking
- ✅ DataGrid with sorting, filtering, pagination

### Backend APIs Needed:

#### POST `/api/sales-orders`
Create new sales order

**Request:**
```json
{
  "customer": "ABC Printers",
  "contactPerson": "Rajesh Kumar",
  "salesman": "Amit Sharma",
  "orderDate": "2026-02-14",
  "lines": [
    {
      "lineNumber": 1,
      "materialId": "mat_001",
      "orderedQty": 10000,
      "rate": 450,
      "amount": 4500000,
      "deliveryAddress": "Plot 12, Industrial Area",
      "requiredDeliveryDate": "2026-03-15",
      "unit": "Sheet"
    }
  ],
  "totalValue": 4500000,
  "remarks": "Urgent delivery required",
  "convertedFromInquiry": "inq_001" // optional
}
```

**Response:**
```json
{
  "id": "so_001",
  "soNumber": "SO-2026-0001",
  "status": "Draft",
  "createdAt": "2026-02-14T11:00:00Z"
}
```

#### POST `/api/sales-orders/{id}/allocate`
Run allocation engine for SO

**Request:**
```json
{
  "allocationStrategy": "Auto | Manual",
  "preferences": {
    "preferStock": true,
    "allowPurchase": true,
    "maxLeadTime": 30
  }
}
```

**Response:**
```json
{
  "allocations": [
    {
      "lineId": "line_001",
      "stockAllocated": 7000,
      "transitAllocated": 2000,
      "purchaseAllocated": 1000,
      "allocationType": "Mixed",
      "stockLots": [
        {
          "lotId": "lot_001",
          "qty": 5000,
          "binLocation": "Lasudia-A-1-A1"
        },
        {
          "lotId": "lot_002",
          "qty": 2000,
          "binLocation": "Lasudia-A-1-A2"
        }
      ],
      "purchaseItems": [
        {
          "poId": "po_001",
          "qty": 1000,
          "mill": "ITC Paperboards",
          "eta": "2026-03-10"
        }
      ]
    }
  ],
  "newStatus": "Fully Allocated | Partially Allocated"
}
```

#### GET `/api/sales-orders/{id}/allocation-details`
Get detailed allocation breakdown

**Response:**
```json
{
  "soNumber": "SO-2026-0001",
  "lines": [
    {
      "lineNumber": 1,
      "material": "Maplitho 80 GSM 23x36",
      "orderedQty": 10000,
      "stockAllocations": [
        {
          "lotNumber": "LOT-2024-001",
          "binLocation": "Lasudia-A-1-A1",
          "qty": 5000,
          "receivedDate": "2024-01-15",
          "status": "Reserved"
        }
      ],
      "purchaseAllocations": [
        {
          "poNumber": "PO-2026-001",
          "mill": "ITC Paperboards",
          "qty": 1000,
          "expectedArrival": "2026-03-10",
          "deliveryMode": "Direct To Customer"
        }
      ],
      "allocationStatus": "Fully Allocated | Partially Allocated",
      "readyForDispatch": true
    }
  ]
}
```

### Business Logic Required:

1. **Auto-numbering:** `SO-YYYY-NNNN`
2. **Allocation Engine:**
   - **Priority 1:** Allocate from physical stock (FIFO - oldest first)
   - **Priority 2:** Allocate from in-transit stock
   - **Priority 3:** Create purchase allocation (if allowed)
   - Update stock lot status: `Available → Reserved`
   - Create `StockAllocation` records with bin locations
   - Create `PurchaseAllocation` records if shortfall
3. **Status Transitions:**
   - Draft → Coverage Pending (on save)
   - Coverage Pending → Partially Allocated (some lines allocated)
   - Partially Allocated → Fully Allocated (all lines allocated)
   - Fully Allocated → In Dispatch (pick plan created)
   - In Dispatch → Partially Delivered (some lines delivered)
   - Partially Delivered → Completed (all lines delivered)
4. **Line-Level Tracking:**
   - Each line has independent status
   - Track qty at each stage: Ordered → Allocated → Picked → Dispatched → Delivered
5. **Delivery Mode Logic:**
   - **From Stock:** Material dispatched from godown
   - **Direct Mill Delivery:** Mill dispatches directly to customer
   - **Mixed:** Partial from stock + partial from mill

---

## 3. Coverage Engine

### Frontend Status: ✅ Integrated in Inquiry & SO Forms

### Backend Logic Needed:

#### Algorithm for Coverage Check:

```python
def check_coverage(material_id, required_qty):
    # Step 1: Physical Stock
    physical_stock = db.query("""
        SELECT SUM(availableQty)
        FROM stock_lots
        WHERE materialId = ? AND status = 'Available'
    """, material_id)

    # Step 2: Transit Stock (In-transit from mill)
    transit_stock = db.query("""
        SELECT SUM(qty)
        FROM mill_tracker
        WHERE materialId = ?
        AND productionStatus = 'Dispatched'
        AND status = 'In Transit'
    """, material_id)

    # Step 3: Reserved Stock (Already allocated to other SOs)
    reserved_stock = db.query("""
        SELECT SUM(qty)
        FROM stock_allocations
        WHERE materialId = ?
        AND status IN ('Reserved', 'Picked')
    """, material_id)

    # Available = Physical - Reserved + Transit
    available = physical_stock - reserved_stock + transit_stock
    coverage_pct = (available / required_qty) * 100

    return {
        'physicalStock': physical_stock,
        'transitStock': transit_stock,
        'reservedStock': reserved_stock,
        'availableStock': available,
        'coveragePercentage': coverage_pct,
        'shortfall': max(0, required_qty - available),
        'millRequired': coverage_pct < 100
    }
```

#### Database Indexes Required:
```sql
CREATE INDEX idx_stock_lots_material_status
ON stock_lots(materialId, status, availableQty);

CREATE INDEX idx_mill_tracker_material_status
ON mill_tracker(materialId, productionStatus, status);

CREATE INDEX idx_stock_allocations_material_status
ON stock_allocations(materialId, status);
```

---

## 4. Purchase Orders to Mill

### Frontend Status: ✅ Fully Implemented

**Location:** `frontend/app/purchase-orders/page.tsx`, `frontend/components/forms/PurchaseOrderForm.tsx`

### Features Implemented:
- ✅ Multi-item PO form with material selection
- ✅ Mill selection dropdown
- ✅ Item-level ready qty tracking
- ✅ Progress indicators (% Ready)
- ✅ Delivery mode (Direct to Customer / To Godown)
- ✅ Status lifecycle (Draft → Sent → Acknowledged → Production → Ready → Dispatched)
- ✅ Expected delivery date with overdue indicators

### Backend APIs Needed:

#### POST `/api/purchase-orders`
Create PO to mill

**Request:**
```json
{
  "mill": "ITC Paperboards",
  "orderDate": "2026-02-14",
  "expectedDeliveryDate": "2026-03-15",
  "deliveryMode": "Direct To Customer | To Godown",
  "items": [
    {
      "materialId": "mat_001",
      "quantity": 10000,
      "rate": 400,
      "amount": 4000000,
      "soNumber": "SO-2026-0001", // if Direct delivery
      "deliveryAddress": "ABC Printers Factory" // if Direct
    }
  ],
  "totalValue": 4000000,
  "totalQuantity": 10000,
  "paymentTerms": "30 days credit",
  "remarks": "Urgent requirement"
}
```

**Response:**
```json
{
  "id": "po_001",
  "poNumber": "PO-2026-0001",
  "status": "Draft",
  "createdAt": "2026-02-14T12:00:00Z"
}
```

#### PATCH `/api/purchase-orders/{id}/send-to-mill`
Send PO to mill (email/WhatsApp)

**Request:**
```json
{
  "sendMethod": "Email | WhatsApp | Both",
  "recipientEmail": "orders@itcpaperboards.com",
  "recipientPhone": "+919876543210",
  "attachPDF": true
}
```

**Response:**
```json
{
  "status": "Sent to Mill",
  "sentAt": "2026-02-14T12:30:00Z",
  "sentVia": ["Email", "WhatsApp"],
  "deliveryStatus": {
    "email": "Delivered",
    "whatsapp": "Read"
  }
}
```

#### PATCH `/api/purchase-orders/{id}/items/{itemId}/update-ready-qty`
Update item ready quantity

**Request:**
```json
{
  "readyQty": 5000,
  "remarks": "First lot ready for dispatch",
  "expectedDispatchDate": "2026-03-10"
}
```

**Response:**
```json
{
  "itemId": "item_001",
  "readyQty": 5000,
  "orderedQty": 10000,
  "readyPercentage": 50,
  "poStatus": "Partial Ready"
}
```

#### POST `/api/purchase-orders/{id}/acknowledge`
Mill acknowledges PO

**Request:**
```json
{
  "acknowledgedBy": "Mill Manager Name",
  "confirmedDeliveryDate": "2026-03-15",
  "remarks": "Order accepted, production scheduled"
}
```

### Business Logic Required:

1. **Auto-numbering:** `PO-YYYY-NNNN`
2. **Status Transitions:**
   - Draft → Sent to Mill (when sent)
   - Sent to Mill → Acknowledged (mill confirms)
   - Acknowledged → In Production (mill starts production)
   - In Production → Partial Ready (some qty ready)
   - Partial Ready → Ready (all qty ready)
   - Ready → Dispatched (mill dispatches)
   - Dispatched → In Transit (tracking created)
   - In Transit → Completed (delivered)
3. **Ready Qty Tracking:**
   - Allow partial ready updates
   - Auto-calculate: `readyPct = (totalReady / totalOrdered) * 100`
   - Update PO status:
     - If any item has readyQty > 0 → "Partial Ready"
     - If all items readyQty = orderedQty → "Ready"
4. **Mill Tracker Integration:**
   - When PO status = "In Production", create Mill Tracker records
   - Sync ready qty from PO items to Mill Tracker
5. **Overdue Detection:**
   - If `expectedDeliveryDate < TODAY` and status != "Delivered" → Mark overdue
   - Send alerts to purchasing team

---

## 5. Mill Tracker

### Frontend Status: ✅ Fully Implemented

**Location:** `frontend/app/mill-tracker/page.tsx`

### Features Implemented:
- ✅ Track mill production status per item
- ✅ Production status (Pending, In Production, Partial Ready, Ready)
- ✅ Dispatch status (Ready, Dispatched, In Transit, Delivered)
- ✅ Ready qty vs Ordered qty tracking
- ✅ SO Number and Delivery Mode display
- ✅ Filter by production status, dispatch status, mill

### Backend APIs Needed:

#### GET `/api/mill-tracker`
Get all mill tracker records

**Query Params:**
```
?mill=ITC Paperboards
&productionStatus=In Production
&status=Ready
&soNumber=SO-2026-0001
&limit=50
&offset=0
```

**Response:**
```json
{
  "data": [
    {
      "id": "mt_001",
      "poNumber": "PO-2026-0001",
      "soNumber": "SO-2026-0001",
      "mill": "ITC Paperboards",
      "paper": "Maplitho 80 GSM 23x36",
      "gsm": 80,
      "size": "23x36",
      "orderedQty": 10000,
      "readyQty": 7000,
      "deliveryMode": "Direct To Customer",
      "productionStatus": "Partial Ready",
      "status": "Ready",
      "expectedDelivery": "2026-03-15",
      "actualDispatchDate": null,
      "destination": "ABC Printers Factory"
    }
  ],
  "total": 45,
  "limit": 50,
  "offset": 0
}
```

#### PATCH `/api/mill-tracker/{id}/update-production-status`
Update production status

**Request:**
```json
{
  "productionStatus": "In Production | Partial Ready | Ready",
  "readyQty": 7000,
  "remarks": "First batch completed"
}
```

#### PATCH `/api/mill-tracker/{id}/dispatch`
Mark as dispatched from mill

**Request:**
```json
{
  "dispatchDate": "2026-03-12",
  "truckNumber": "MP09AB1234",
  "driverName": "Ramesh Kumar",
  "driverPhone": "9876543210",
  "lrNumber": "LR-12345",
  "transporterName": "XYZ Logistics",
  "estimatedArrival": "2026-03-14"
}
```

**Response:**
```json
{
  "id": "mt_001",
  "status": "Dispatched",
  "trackingNumber": "TRK-2026-0001",
  "inTransitRecordCreated": true
}
```

### Business Logic Required:

1. **Auto-sync with PO:**
   - When PO item ready qty updated → Update Mill Tracker ready qty
   - When PO status = "Dispatched" → Update Mill Tracker status = "Dispatched"
2. **Status Rules:**
   - Production Status:
     - Pending (PO acknowledged, not started)
     - In Production (mill confirmed production started)
     - Partial Ready (0 < readyQty < orderedQty)
     - Ready (readyQty = orderedQty)
   - Dispatch Status:
     - Ready (awaiting dispatch)
     - Dispatched (left mill)
     - In Transit (on the road)
     - Delivered (reached destination)
3. **Dispatch Trigger:**
   - When status → "Dispatched":
     - Create `InTransitTracking` record
     - If deliveryMode = "Direct To Customer" → Link to SO
     - If deliveryMode = "To Godown" → Prepare for GRN
4. **Quality Check:**
   - Allow rejection of partial qty (quality issues)
   - Reduce ready qty if rejected
   - Create debit note to mill

---

## 6. Stock Management

### Frontend Status: ✅ Implemented

**Location:** `frontend/app/stock-lots/page.tsx`

### Features Implemented:
- ✅ Stock lot listing with bin locations
- ✅ Available, Allocated, Depleted status tracking
- ✅ FIFO age calculation
- ✅ Quality grade tracking
- ✅ Mill and received date tracking

### Backend APIs Needed:

#### GET `/api/stock-lots`
Get stock lots

**Query Params:**
```
?warehouse=Lasudia
&status=Available
&materialId=mat_001
&binLocation=Lasudia-A-1-A1
```

**Response:**
```json
{
  "data": [
    {
      "id": "lot_001",
      "lotNumber": "LOT-2024-001",
      "materialId": "mat_001",
      "paper": "Maplitho 80 GSM 23x36",
      "gsm": 80,
      "size": "23x36",
      "mill": "ITC Paperboards",
      "receivedQty": 10000,
      "availableQty": 7000,
      "allocatedQty": 3000,
      "binLocation": "Lasudia-A-1-A1",
      "warehouse": "Lasudia",
      "receivedDate": "2024-01-15",
      "status": "Available | Allocated | Depleted",
      "quality": "A Grade | B Grade",
      "ageDays": 30
    }
  ]
}
```

#### POST `/api/stock-lots`
Create stock lot (from GRN)

**Request:**
```json
{
  "grnId": "grn_001",
  "materialId": "mat_001",
  "receivedQty": 10000,
  "binLocation": "Lasudia-A-1-A1",
  "warehouse": "Lasudia",
  "mill": "ITC Paperboards",
  "quality": "A Grade",
  "batchNumber": "BATCH-2024-001",
  "manufacturingDate": "2024-01-10"
}
```

#### PATCH `/api/stock-lots/{id}/reserve`
Reserve stock for SO

**Request:**
```json
{
  "soId": "so_001",
  "soLineId": "line_001",
  "reservedQty": 3000
}
```

**Response:**
```json
{
  "lotId": "lot_001",
  "availableQty": 7000,
  "allocatedQty": 3000,
  "status": "Allocated"
}
```

### Business Logic Required:

1. **FIFO Enforcement:**
   - Always pick oldest stock first (by receivedDate)
   - Query: `ORDER BY receivedDate ASC`
2. **Status Auto-Update:**
   - If `availableQty = 0` → status = "Depleted"
   - If `allocatedQty > 0` → status = "Allocated"
   - If `allocatedQty = 0 AND availableQty > 0` → status = "Available"
3. **Bin Location Management:**
   - Track bin capacity
   - Prevent overfilling bins
   - Suggest available bins for new stock
4. **Stock Aging:**
   - Calculate: `ageDays = TODAY - receivedDate`
   - Alert if stock age > 90 days (slow-moving)
5. **Quality Tracking:**
   - A Grade: Full price
   - B Grade: Discounted price
   - Damaged: Cannot allocate

---

## 7. Dispatch Queue

### Frontend Status: ✅ Fully Implemented

**Location:** `frontend/app/dispatch-queue/page.tsx`

### Features Implemented:
- ✅ Shows SO lines with stock allocated
- ✅ Priority-based sorting (Urgent → High → Normal)
- ✅ Delivery date urgency indicators
- ✅ "Create Pick Plan" button per line
- ✅ KPI cards (Total Pending, Urgent, High, Normal, Total Qty)

### Backend APIs Needed:

#### GET `/api/dispatch-queue`
Get items ready for picking

**Query Params:**
```
?priority=Urgent
&deliveryDateFrom=2026-02-14
&deliveryDateTo=2026-03-14
```

**Response:**
```json
{
  "data": [
    {
      "soNumber": "SO-2026-0001",
      "soId": "so_001",
      "lineId": "line_001",
      "lineNumber": 1,
      "customer": "ABC Printers",
      "orderDate": "2026-02-14",
      "expectedDelivery": "2026-03-15",
      "material": "Maplitho 80 GSM 23x36",
      "gsm": 80,
      "size": "23x36",
      "orderedQty": 10000,
      "stockAllocated": 7000,
      "daysUntilDelivery": 29,
      "priority": "Normal | High | Urgent",
      "hasPickPlan": false
    }
  ],
  "kpis": {
    "total": 45,
    "urgent": 5,
    "high": 12,
    "normal": 28,
    "totalQty": 450000
  }
}
```

### Business Logic Required:

1. **Queue Population:**
   - Include SO lines where: `stockAllocated > 0 AND status NOT IN ('Dispatched', 'Delivered')`
   - Exclude lines with existing pick plans
2. **Priority Calculation:**
   ```python
   daysUntil = (deliveryDate - today).days
   if daysUntil <= 0: priority = "Urgent"
   elif daysUntil <= 3: priority = "High"
   else: priority = "Normal"
   ```
3. **Sorting:**
   - Priority: Urgent → High → Normal
   - Within priority: Earliest delivery date first
4. **KPI Calculations:**
   - Real-time counts and totals
   - Update on any pick plan creation

---

## 8. Pick Plan

### Frontend Status: ✅ Fully Implemented with Advanced Modal

**Location:** `frontend/app/dispatch-queue/page.tsx` (Modal), `frontend/app/pick-plan/page.tsx` (List)

### Features Implemented:
- ✅ **FIFO Bin Selection:** Oldest stock highlighted (based on GRN Date)
- ✅ **Auto Allocate FIFO:** Smart distribution button with automatic bin splitting
- ✅ **Real-time Validation:** Picked qty must = allocated qty
- ✅ **Stock Age Indicators:** Color-coded (< 30 days green, 30-60 yellow, > 60 red)
- ✅ **Pick Summary:** Total Required, Total Selected, Balance, Status
- ✅ **Dispatch Mode Selection:** Direct to Customer / To Godown
- ✅ **Read-only SO Header:** Prevents data tampering
- ✅ **Bin-level Quantity Tracking:** Multi-bin allocation support

### Purpose & Context:

The Pick Plan screen converts **Sales Order Items → Warehouse Picking Tasks**. It must:
- Pick stock based on **FIFO (Oldest GRN first)**
- Respect **Bin-level quantity** constraints
- Avoid **over-allocation**
- Generate a **structured picking instruction** for warehouse staff
- Support **automatic quantity splitting** across multiple bins
- Implement **stock locking/reservation** mechanism

### Database Structure:

#### PickPlanMaster Table
```sql
CREATE TABLE pick_plan_master (
  id SERIAL PRIMARY KEY,
  pick_plan_number VARCHAR(50) UNIQUE NOT NULL, -- PP-YYYY-NNNN
  so_id INT REFERENCES sales_orders(id),
  so_number VARCHAR(50) NOT NULL,
  so_line_id INT REFERENCES sales_order_lines(id),
  customer_name VARCHAR(255) NOT NULL,
  material_id INT REFERENCES materials(id),
  material_name VARCHAR(255) NOT NULL,
  gsm INT,
  size VARCHAR(50),
  total_qty INT NOT NULL,
  delivery_mode VARCHAR(50), -- Direct To Customer / To Godown
  warehouse VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Pending', -- Pending | In Progress | Completed | Cancelled
  planned_pick_date DATE,
  actual_pick_date DATE,
  picked_by VARCHAR(100),
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### PickPlanItems Table (Bin-level Details)
```sql
CREATE TABLE pick_plan_items (
  id SERIAL PRIMARY KEY,
  pick_plan_id INT REFERENCES pick_plan_master(id),
  grn_id INT REFERENCES grn(id), -- Link to GRN for FIFO tracking
  lot_number VARCHAR(50) NOT NULL,
  bin_location VARCHAR(100) NOT NULL,
  qty_to_pick INT NOT NULL,
  qty_picked INT DEFAULT 0,
  pick_sequence INT NOT NULL, -- 1, 2, 3... (FIFO order)
  grn_date DATE NOT NULL, -- For FIFO sorting
  stock_age_days INT, -- Calculated from GRN date
  status VARCHAR(50) DEFAULT 'Pending', -- Pending | Picked
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### StockReservation Table
```sql
CREATE TABLE stock_reservation (
  id SERIAL PRIMARY KEY,
  pick_plan_id INT REFERENCES pick_plan_master(id),
  stock_lot_id INT REFERENCES stock_lots(id),
  lot_number VARCHAR(50) NOT NULL,
  bin_location VARCHAR(100) NOT NULL,
  reserved_qty INT NOT NULL,
  reservation_date TIMESTAMP DEFAULT NOW(),
  released_date TIMESTAMP, -- When reservation is released (cancellation/completion)
  status VARCHAR(50) DEFAULT 'Reserved', -- Reserved | Picked | Released
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Backend APIs Needed:

#### GET `/api/pick-plans/available-bins`
Get FIFO-sorted bins for a material (called when Pick Plan modal opens)

**Query Params:**
```
?materialId=mat_001
&warehouse=Lasudia
&requiredQty=7000
```

**Response:**
```json
{
  "material": "Maplitho 80 GSM 23x36",
  "totalAvailable": 9500,
  "requiredQty": 7000,
  "bins": [
    {
      "lotNumber": "LOT-2024-001",
      "binLocation": "Lasudia-A-1-A1",
      "grnId": "grn_001",
      "grnNumber": "GRN-2024-0001",
      "grnDate": "2024-01-15",
      "availableQty": 5000,
      "allocatedQty": 0,
      "stockAgeDays": 30,
      "quality": "A Grade",
      "mill": "ITC Paperboards"
    },
    {
      "lotNumber": "LOT-2024-002",
      "binLocation": "Lasudia-A-1-A2",
      "grnId": "grn_002",
      "grnNumber": "GRN-2024-0002",
      "grnDate": "2024-02-01",
      "availableQty": 3000,
      "allocatedQty": 0,
      "stockAgeDays": 14,
      "quality": "A Grade",
      "mill": "ITC Paperboards"
    },
    {
      "lotNumber": "LOT-2024-003",
      "binLocation": "Lasudia-A-1-A3",
      "grnId": "grn_003",
      "grnNumber": "GRN-2024-0003",
      "grnDate": "2024-02-10",
      "availableQty": 1500,
      "allocatedQty": 0,
      "stockAgeDays": 5,
      "quality": "A Grade",
      "mill": "ITC Paperboards"
    }
  ],
  "fifoRecommendation": [
    {
      "binLocation": "Lasudia-A-1-A1",
      "qtyToAllocate": 5000,
      "pickSequence": 1
    },
    {
      "binLocation": "Lasudia-A-1-A2",
      "qtyToAllocate": 2000,
      "pickSequence": 2
    }
  ]
}
```

#### POST `/api/pick-plans`
Create pick plan with FIFO allocation and stock reservation

**Request:**
```json
{
  "soId": "so_001",
  "soLineId": "line_001",
  "soNumber": "SO-2026-0001",
  "lineNumber": 1,
  "customer": "ABC Printers",
  "materialId": "mat_001",
  "material": "Maplitho 80 GSM 23x36",
  "gsm": 80,
  "size": "23x36",
  "totalQty": 7000,
  "deliveryMode": "Direct To Customer",
  "warehouse": "Lasudia",
  "plannedPickDate": "2026-02-15",
  "items": [
    {
      "grnId": "grn_001",
      "lotNumber": "LOT-2024-001",
      "binLocation": "Lasudia-A-1-A1",
      "qtyToAllocate": 5000,
      "pickSequence": 1,
      "grnDate": "2024-01-15"
    },
    {
      "grnId": "grn_002",
      "lotNumber": "LOT-2024-002",
      "binLocation": "Lasudia-A-1-A2",
      "qtyToAllocate": 2000,
      "pickSequence": 2,
      "grnDate": "2024-02-01"
    }
  ]
}
```

**Response:**
```json
{
  "id": "pp_001",
  "pickPlanNumber": "PP-2026-0001",
  "status": "Pending",
  "totalQty": 7000,
  "binsAllocated": 2,
  "reservations": [
    {
      "reservationId": "res_001",
      "lotNumber": "LOT-2024-001",
      "binLocation": "Lasudia-A-1-A1",
      "reservedQty": 5000,
      "status": "Reserved"
    },
    {
      "reservationId": "res_002",
      "lotNumber": "LOT-2024-002",
      "binLocation": "Lasudia-A-1-A2",
      "reservedQty": 2000,
      "status": "Reserved"
    }
  ],
  "createdAt": "2026-02-14T14:00:00Z",
  "message": "Pick plan created successfully. Stock reserved for SO-2026-0001."
}
```

#### PATCH `/api/pick-plans/{id}/start-picking`
Mark pick plan as In Progress

**Request:**
```json
{
  "pickedBy": "Warehouse Supervisor",
  "startTime": "2026-02-15T09:00:00Z"
}
```

**Response:**
```json
{
  "pickPlanNumber": "PP-2026-0001",
  "status": "In Progress",
  "pickedBy": "Warehouse Supervisor",
  "items": [
    {
      "binLocation": "Lasudia-A-1-A1",
      "qtyToPick": 5000,
      "pickSequence": 1,
      "status": "Pending"
    }
  ]
}
```

#### PATCH `/api/pick-plans/{id}/items/{itemId}/mark-picked`
Mark individual bin as picked

**Request:**
```json
{
  "qtyPicked": 5000,
  "pickedAt": "2026-02-15T09:30:00Z",
  "remarks": "All material in good condition"
}
```

#### PATCH `/api/pick-plans/{id}/complete`
Mark pick plan as Completed

**Request:**
```json
{
  "completedBy": "Warehouse Supervisor",
  "completedAt": "2026-02-15T10:30:00Z",
  "remarks": "All items picked successfully"
}
```

**Response:**
```json
{
  "pickPlanNumber": "PP-2026-0001",
  "status": "Completed",
  "totalQty": 7000,
  "totalPicked": 7000,
  "variance": 0,
  "stockReservationsReleased": true,
  "nextStep": "Create Challan",
  "challanDraftCreated": true,
  "challanId": "chl_001"
}
```

#### POST `/api/pick-plans/{id}/recalculate`
Recalculate FIFO allocation (if stock changes)

**Response:**
```json
{
  "pickPlanNumber": "PP-2026-0001",
  "previousAllocation": [
    { "binLocation": "Lasudia-A-1-A1", "qty": 5000 }
  ],
  "newAllocation": [
    { "binLocation": "Lasudia-A-1-A1", "qty": 4000 },
    { "binLocation": "Lasudia-A-1-A2", "qty": 3000 }
  ],
  "reason": "Stock reduced in Bin A1, reallocated to Bin A2",
  "message": "Pick plan recalculated based on current stock levels"
}
```

#### POST `/api/pick-plans/{id}/cancel`
Cancel pick plan and release reservations

**Request:**
```json
{
  "cancelledBy": "Manager",
  "reason": "Customer cancelled order",
  "cancelledAt": "2026-02-15T11:00:00Z"
}
```

**Response:**
```json
{
  "pickPlanNumber": "PP-2026-0001",
  "status": "Cancelled",
  "reservationsReleased": 2,
  "stockLotsUpdated": [
    {
      "lotNumber": "LOT-2024-001",
      "releasedQty": 5000,
      "newAvailableQty": 5000
    }
  ]
}
```

#### GET `/api/pick-plans/{id}/print-slip`
Generate printable pick slip

**Response:**
```json
{
  "pickPlanNumber": "PP-2026-0001",
  "pdfUrl": "https://storage.monit.com/pick-slips/PP-2026-0001.pdf",
  "qrCode": "https://storage.monit.com/qr/PP-2026-0001.png",
  "content": {
    "header": {
      "soNumber": "SO-2026-0001",
      "customer": "ABC Printers",
      "material": "Maplitho 80 GSM 23x36",
      "totalQty": 7000
    },
    "pickingInstructions": [
      {
        "sequence": 1,
        "binLocation": "Lasudia-A-1-A1",
        "qtyToPick": 5000,
        "lotNumber": "LOT-2024-001"
      },
      {
        "sequence": 2,
        "binLocation": "Lasudia-A-1-A2",
        "qtyToPick": 2000,
        "lotNumber": "LOT-2024-002"
      }
    ]
  }
}
```

### Business Logic Required:

#### 1. FIFO Logic (Oldest GRN First)
```python
def get_fifo_bins(material_id, required_qty, warehouse):
    """
    Fetch available bins sorted by GRN Date (oldest first)
    """
    bins = db.query("""
        SELECT sl.lot_number, sl.bin_location, sl.available_qty,
               g.grn_number, g.grn_date, g.id AS grn_id,
               DATEDIFF(CURDATE(), g.grn_date) AS stock_age_days
        FROM stock_lots sl
        JOIN grn g ON sl.grn_id = g.id
        WHERE sl.material_id = ?
          AND sl.warehouse = ?
          AND sl.available_qty > 0
          AND sl.status = 'Available'
        ORDER BY g.grn_date ASC, sl.lot_number ASC
    """, material_id, warehouse)

    return bins
```

#### 2. Auto-split Quantity Across Bins
```python
def auto_allocate_fifo(bins, required_qty):
    """
    Automatically split required quantity across bins (FIFO)
    """
    allocations = []
    remaining = required_qty
    sequence = 1

    for bin in bins:
        if remaining <= 0:
            break

        qty_to_allocate = min(remaining, bin.available_qty)

        allocations.append({
            'lotNumber': bin.lot_number,
            'binLocation': bin.bin_location,
            'grnId': bin.grn_id,
            'grnDate': bin.grn_date,
            'qtyToAllocate': qty_to_allocate,
            'pickSequence': sequence,
            'stockAgeDays': bin.stock_age_days
        })

        remaining -= qty_to_allocate
        sequence += 1

    if remaining > 0:
        raise InsufficientStockError(f"Shortage of {remaining} units")

    return allocations
```

#### 3. Stock Locking/Reservation
```python
def create_pick_plan(pick_plan_data):
    """
    Create pick plan with automatic stock reservation
    """
    # Validate total quantity
    total_allocated = sum(item['qtyToAllocate'] for item in pick_plan_data['items'])
    if total_allocated != pick_plan_data['totalQty']:
        raise ValidationError("Total allocated qty must equal required qty")

    # Create PickPlanMaster record
    pick_plan = db.insert('pick_plan_master', {
        'pick_plan_number': generate_number('PP'),
        'so_id': pick_plan_data['soId'],
        'so_number': pick_plan_data['soNumber'],
        'so_line_id': pick_plan_data['soLineId'],
        'customer_name': pick_plan_data['customer'],
        'material_id': pick_plan_data['materialId'],
        'total_qty': pick_plan_data['totalQty'],
        'delivery_mode': pick_plan_data['deliveryMode'],
        'warehouse': pick_plan_data['warehouse'],
        'status': 'Pending',
        'planned_pick_date': pick_plan_data['plannedPickDate']
    })

    # Create PickPlanItems and Stock Reservations
    for item in pick_plan_data['items']:
        # Insert pick plan item
        db.insert('pick_plan_items', {
            'pick_plan_id': pick_plan.id,
            'grn_id': item['grnId'],
            'lot_number': item['lotNumber'],
            'bin_location': item['binLocation'],
            'qty_to_pick': item['qtyToAllocate'],
            'pick_sequence': item['pickSequence'],
            'grn_date': item['grnDate'],
            'stock_age_days': calculate_age(item['grnDate']),
            'status': 'Pending'
        })

        # Create stock reservation
        db.insert('stock_reservation', {
            'pick_plan_id': pick_plan.id,
            'stock_lot_id': get_lot_id(item['lotNumber']),
            'lot_number': item['lotNumber'],
            'bin_location': item['binLocation'],
            'reserved_qty': item['qtyToAllocate'],
            'status': 'Reserved'
        })

        # Update stock lot: Reduce available qty, increase allocated qty
        db.update('stock_lots',
            WHERE={'lot_number': item['lotNumber']},
            SET={
                'available_qty': db.raw('available_qty - ?', item['qtyToAllocate']),
                'allocated_qty': db.raw('allocated_qty + ?', item['qtyToAllocate']),
                'status': 'Allocated'
            }
        )

    # Update SO Line status
    db.update('sales_order_lines',
        WHERE={'id': pick_plan_data['soLineId']},
        SET={'status': 'Pick Plan Created'}
    )

    return pick_plan
```

#### 4. Status Lifecycle Management
```python
# Status Transitions
ALLOWED_TRANSITIONS = {
    'Pending': ['In Progress', 'Cancelled'],
    'In Progress': ['Completed', 'Cancelled'],
    'Completed': [],  # Terminal state
    'Cancelled': []   # Terminal state
}

def update_status(pick_plan_id, new_status, user):
    pick_plan = db.get('pick_plan_master', pick_plan_id)
    current_status = pick_plan.status

    if new_status not in ALLOWED_TRANSITIONS[current_status]:
        raise InvalidTransitionError(
            f"Cannot transition from {current_status} to {new_status}"
        )

    db.update('pick_plan_master',
        WHERE={'id': pick_plan_id},
        SET={
            'status': new_status,
            'updated_at': datetime.now(),
            'updated_by': user
        }
    )

    # Handle side effects
    if new_status == 'Completed':
        complete_pick_plan(pick_plan_id)
    elif new_status == 'Cancelled':
        release_reservations(pick_plan_id)
```

#### 5. Validation Rules
```python
def validate_pick_plan(pick_plan_data):
    """
    Comprehensive validation before creating pick plan
    """
    # Rule 1: Total picked qty must equal allocated qty
    total_picked = sum(item['qtyToAllocate'] for item in pick_plan_data['items'])
    if total_picked != pick_plan_data['totalQty']:
        raise ValidationError(
            f"Total picked ({total_picked}) != Required ({pick_plan_data['totalQty']})"
        )

    # Rule 2: Verify FIFO order (GRN dates ascending)
    grn_dates = [datetime.fromisoformat(item['grnDate']) for item in pick_plan_data['items']]
    if grn_dates != sorted(grn_dates):
        raise FIFOViolationError("Items must be sorted by GRN date (oldest first)")

    # Rule 3: Verify bin availability
    for item in pick_plan_data['items']:
        available = db.query_one("""
            SELECT available_qty FROM stock_lots
            WHERE lot_number = ? AND bin_location = ?
        """, item['lotNumber'], item['binLocation'])

        if available < item['qtyToAllocate']:
            raise InsufficientStockError(
                f"Bin {item['binLocation']} has only {available} units available"
            )

    # Rule 4: Check for duplicate pick plans
    existing = db.query_one("""
        SELECT id FROM pick_plan_master
        WHERE so_line_id = ? AND status IN ('Pending', 'In Progress')
    """, pick_plan_data['soLineId'])

    if existing:
        raise DuplicatePickPlanError(
            f"Active pick plan already exists for this SO line"
        )

    return True
```

#### 6. Stock Reservation Release (on Cancellation)
```python
def release_reservations(pick_plan_id):
    """
    Release all stock reservations when pick plan is cancelled
    """
    reservations = db.query("""
        SELECT * FROM stock_reservation
        WHERE pick_plan_id = ? AND status = 'Reserved'
    """, pick_plan_id)

    for res in reservations:
        # Update stock lot: Increase available, decrease allocated
        db.update('stock_lots',
            WHERE={'lot_number': res.lot_number},
            SET={
                'available_qty': db.raw('available_qty + ?', res.reserved_qty),
                'allocated_qty': db.raw('allocated_qty - ?', res.reserved_qty)
            }
        )

        # Update reservation status
        db.update('stock_reservation',
            WHERE={'id': res.id},
            SET={
                'status': 'Released',
                'released_date': datetime.now()
            }
        )

    # Update stock lot status if no more allocations
    db.execute("""
        UPDATE stock_lots
        SET status = 'Available'
        WHERE allocated_qty = 0 AND available_qty > 0
    """)
```

#### 7. Next Step Trigger (Create Challan Draft)
```python
def complete_pick_plan(pick_plan_id):
    """
    Mark pick plan as completed and trigger next step
    """
    pick_plan = db.get('pick_plan_master', pick_plan_id)

    # Verify all items picked
    pending_items = db.query_one("""
        SELECT COUNT(*) FROM pick_plan_items
        WHERE pick_plan_id = ? AND status != 'Picked'
    """, pick_plan_id)

    if pending_items > 0:
        raise ValidationError("Cannot complete: Some items not yet picked")

    # Update SO Line status
    db.update('sales_order_lines',
        WHERE={'id': pick_plan.so_line_id},
        SET={'status': 'Picked, Awaiting Challan'}
    )

    # Auto-create Challan draft
    challan = db.insert('challans', {
        'pick_plan_id': pick_plan_id,
        'so_number': pick_plan.so_number,
        'status': 'Draft',
        'warehouse': pick_plan.warehouse
    })

    return {
        'nextStep': 'Create Challan',
        'challanDraftCreated': True,
        'challanId': challan.id
    }
```

### Advanced Features (Future Enhancement):

#### 1. Recalculate Button
- **Purpose:** Recalculate FIFO allocation if stock levels change after pick plan creation
- **Use Case:** Stock was consumed by another order, need to re-optimize bins
- **Logic:** Release current reservations → Re-run FIFO algorithm → Create new reservations

#### 2. Manual Override Option
- **Purpose:** Allow warehouse manager to override FIFO in special cases
- **Use Case:** Older stock has quality issues, need to pick newer stock
- **Permission:** Requires Manager approval
- **Audit:** Log all manual overrides with reason

#### 3. Print Pick Slip
- **Purpose:** Generate physical picking instruction for warehouse staff
- **Format:** PDF with QR code, bin locations in sequence, qty per bin
- **Content:** SO Number, Customer, Material, Total Qty, Bin-wise picking instructions

### Database Indexes (Critical for Performance):

```sql
-- FIFO sorting performance
CREATE INDEX idx_grn_date_material ON grn(grn_date ASC, material_id);
CREATE INDEX idx_stock_lots_grn ON stock_lots(grn_id, material_id, available_qty);

-- Pick plan queries
CREATE INDEX idx_pick_plan_so ON pick_plan_master(so_id, so_line_id, status);
CREATE INDEX idx_pick_plan_status ON pick_plan_master(status, planned_pick_date);

-- Stock reservation lookups
CREATE INDEX idx_reservation_plan ON stock_reservation(pick_plan_id, status);
CREATE INDEX idx_reservation_lot ON stock_reservation(lot_number, status);
```

### Testing Checklist:

- ✅ FIFO sorting with 100+ bins (performance test)
- ✅ Auto-split across 5+ bins
- ✅ Stock reservation concurrency (2 pick plans for same stock)
- ✅ Validation: Total picked != required
- ✅ Validation: Insufficient bin qty
- ✅ Validation: Duplicate pick plan for same SO line
- ✅ Status transitions (Pending → In Progress → Completed)
- ✅ Cancellation flow (reservation release, stock update)
- ✅ Recalculate with stock changes
- ✅ Manual override with approval
- ✅ Print slip generation (PDF + QR code)

---

## 9. Challan & Loading

### Frontend Status: ✅ Fully Implemented - Control Gate System

**Location:** `frontend/app/challan/page.tsx`

### Purpose & Context:

Challan & Loading is the **control gate** between Warehouse → Truck → Customer. It is NOT a simple list page. It controls the entire loading-to-dispatch workflow with strict status transitions.

**Entry Criteria** — Only items appear here when:
- Pick Plan Status = **Completed**
- Assigned Truck Load Plan exists
- Stock deducted from bin
- Status = **Ready for Loading**

### Features Implemented:
- ✅ **Status Flow:** Ready → Loading → Loaded → Dispatched (strict transitions)
- ✅ **Challan Detail Modal** with 4 sections:
  - Section A — Order Info (SO, Customer, Delivery Mode, Warehouse, Address, Expected Date)
  - Section B — Item Details (auto-filled from Pick Plan, read-only: Item, GSM, Size, Ordered, Picked, Balance, Bin, Lot)
  - Section C — Loading Control (Truck from TLP, Loading Start/End, Bundles, Weight, LR, E-Way Bill, Gate Out, Transport Cost)
  - Section D — Linked Records (SO → Pick Plan → TLP → Challan → Invoice chain)
- ✅ **Status Transition Buttons:** Start Loading, Complete Loading, Dispatch
- ✅ **Dispatch Confirmation Modal** with side-effect warnings
- ✅ **Sales Invoice Generation** (post-dispatch, with Tally Export Queue)
- ✅ **KPI Cards:** Ready, Loading, Loaded, Dispatched, Invoiced, Total Qty
- ✅ **Grid Columns:** Challan #, Date, SO #, Customer, Delivery Mode, Items, Truck #, Driver, LR #, E-Way Bill, Dispatch Time, Status, Invoice #

### Database Structure:

#### Challans Table
```sql
CREATE TABLE challans (
  id SERIAL PRIMARY KEY,
  challan_number VARCHAR(50) UNIQUE NOT NULL,  -- CH-YYYY-NNNN
  challan_date DATE NOT NULL,
  so_id INT REFERENCES sales_orders(id),
  so_number VARCHAR(50) NOT NULL,
  pick_plan_id INT REFERENCES pick_plan_master(id),
  pick_plan_number VARCHAR(50) NOT NULL,
  truck_load_plan_id INT REFERENCES truck_load_plans(id),
  truck_load_plan_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_address TEXT,
  delivery_mode VARCHAR(50) NOT NULL,  -- Direct To Customer / To Godown
  warehouse VARCHAR(100),
  expected_delivery_date DATE,

  -- Truck & Driver (auto from TLP)
  truck_number VARCHAR(50) NOT NULL,
  driver_name VARCHAR(100),
  driver_phone VARCHAR(20),
  transporter_name VARCHAR(255),

  -- Loading details
  loading_start_time TIMESTAMP,
  loading_end_time TIMESTAMP,
  loaded_by VARCHAR(100),
  number_of_bundles INT,
  weight_kg DECIMAL(10,2),

  -- Logistics
  lr_number VARCHAR(50),
  eway_bill_number VARCHAR(50),
  gate_out_time TIMESTAMP,
  dispatch_time TIMESTAMP,
  transport_cost DECIMAL(10,2),

  -- Status
  status VARCHAR(50) DEFAULT 'Ready',  -- Ready | Loading | Loaded | Dispatched

  -- Invoice
  invoice_number VARCHAR(50),
  invoice_eligible BOOLEAN DEFAULT FALSE,

  -- Tracking
  in_transit_tracking_id VARCHAR(50),

  remarks TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### ChallanItems Table
```sql
CREATE TABLE challan_items (
  id SERIAL PRIMARY KEY,
  challan_id INT REFERENCES challans(id),
  so_line_id INT REFERENCES sales_order_lines(id),
  material_id INT REFERENCES materials(id),
  paper VARCHAR(255),
  gsm INT,
  size VARCHAR(50),
  ordered_qty INT NOT NULL,
  picked_qty INT NOT NULL,
  quantity INT NOT NULL,  -- Actual qty loaded
  lot_number VARCHAR(50),
  bin_location VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Backend APIs Needed:

#### GET `/api/challans`
Get challans (filtered by status)

**Query Params:**
```
?status=Ready|Loading|Loaded|Dispatched
&warehouse=Lasudia
&fromDate=2026-02-01
&toDate=2026-02-28
```

**Response:**
```json
{
  "data": [
    {
      "id": "chl_001",
      "challanNumber": "CH-2026-0001",
      "challanDate": "2026-02-15",
      "soNumber": "SO-2026-0001",
      "pickPlanNumber": "PP-2026-0001",
      "truckLoadPlanNumber": "TLP-2026-0001",
      "customer": "ABC Printers",
      "customerAddress": "Plot 12, Industrial Area",
      "deliveryMode": "Direct To Customer",
      "warehouse": "Lasudia",
      "expectedDeliveryDate": "2026-02-16",
      "truckNumber": "MP09AB1234",
      "driverName": "Ramesh Kumar",
      "driverPhone": "9876543210",
      "transporterName": "XYZ Logistics",
      "status": "Ready",
      "totalQty": 7000,
      "totalWeight": 6300,
      "lines": [
        {
          "paper": "Maplitho 80 GSM 23x36",
          "gsm": 80,
          "size": "23x36",
          "orderedQty": 10000,
          "pickedQty": 7000,
          "quantity": 7000,
          "lotNumber": "LOT-2024-001",
          "binLocation": "Lasudia-A-1-A1"
        }
      ]
    }
  ],
  "kpis": {
    "ready": 5,
    "loading": 2,
    "loaded": 3,
    "dispatched": 15,
    "invoiced": 12,
    "totalQty": 150000
  }
}
```

#### POST `/api/challans`
Auto-create challan when Pick Plan is completed and TLP assigned

**Request:**
```json
{
  "pickPlanId": "pp_001",
  "truckLoadPlanId": "tlp_001",
  "challanDate": "2026-02-15"
}
```

**Response:**
```json
{
  "id": "chl_001",
  "challanNumber": "CH-2026-0001",
  "status": "Ready",
  "message": "Challan created. Ready for loading."
}
```

#### PATCH `/api/challans/{id}/start-loading`
Start loading process (Ready → Loading)

**Request:**
```json
{
  "startedBy": "Warehouse Supervisor",
  "startTime": "2026-02-15T09:00:00Z"
}
```

**Response:**
```json
{
  "challanNumber": "CH-2026-0001",
  "status": "Loading",
  "loadingStartTime": "2026-02-15T09:00:00Z"
}
```

#### PATCH `/api/challans/{id}/complete-loading`
Complete loading process (Loading → Loaded)

**Request:**
```json
{
  "loadedBy": "Warehouse Team A",
  "endTime": "2026-02-15T10:30:00Z",
  "numberOfBundles": 16,
  "weightKg": 4800,
  "remarks": "All items loaded, quality verified"
}
```

**Response:**
```json
{
  "challanNumber": "CH-2026-0001",
  "status": "Loaded",
  "loadingStartTime": "2026-02-15T09:00:00Z",
  "loadingEndTime": "2026-02-15T10:30:00Z",
  "loadingDuration": "1h 30m",
  "numberOfBundles": 16,
  "weightKg": 4800
}
```

#### PATCH `/api/challans/{id}/dispatch`
Dispatch truck (Loaded → Dispatched) — **Critical: triggers multiple side effects**

**Request:**
```json
{
  "lrNumber": "LR-2026-0051",
  "eWayBillNumber": "EWB-331200045678",
  "gateOutTime": "2026-02-15T10:45:00Z",
  "transportCost": 4500,
  "dispatchedBy": "Gate Supervisor",
  "remarks": "All clear, truck dispatched"
}
```

**Response:**
```json
{
  "challanNumber": "CH-2026-0001",
  "status": "Dispatched",
  "dispatchTime": "2026-02-15T10:45:00Z",
  "sideEffects": {
    "inTransitCreated": true,
    "trackingId": "TRK-2026-0001",
    "pickPlanLocked": true,
    "stockPermanentlyReduced": true,
    "invoiceEligible": true
  }
}
```

#### POST `/api/challans/{id}/generate-invoice`
Generate sales invoice from dispatched challan

**Request:**
```json
{
  "generatedBy": "Accounts Team"
}
```

**Response:**
```json
{
  "challanNumber": "CH-2026-0001",
  "invoiceNumber": "INV-2026-0001",
  "customer": "ABC Printers",
  "lines": [
    {
      "paper": "Maplitho 80 GSM 23x36",
      "quantity": 7000,
      "rate": 45.00,
      "amount": 315000,
      "gst": 56700,
      "totalWithGst": 371700
    }
  ],
  "totalAmount": 315000,
  "totalGst": 56700,
  "grandTotal": 371700,
  "tallyExportQueued": true,
  "invoicePdfUrl": "https://storage.monit.com/invoices/INV-2026-0001.pdf"
}
```

### Business Logic Required:

#### 1. Challan Auto-Creation
```python
def auto_create_challan(pick_plan_id, truck_load_plan_id):
    """
    Auto-triggered when Pick Plan = Completed AND TLP is assigned
    """
    pick_plan = db.get('pick_plan_master', pick_plan_id)
    tlp = db.get('truck_load_plans', truck_load_plan_id)

    # Validate preconditions
    if pick_plan.status != 'Completed':
        raise ValidationError("Pick Plan must be Completed")
    if not tlp:
        raise ValidationError("Truck Load Plan must be assigned")

    challan = db.insert('challans', {
        'challan_number': generate_number('CH'),
        'so_id': pick_plan.so_id,
        'so_number': pick_plan.so_number,
        'pick_plan_id': pick_plan_id,
        'truck_load_plan_id': truck_load_plan_id,
        'customer_name': pick_plan.customer_name,
        'delivery_mode': pick_plan.delivery_mode,
        'warehouse': pick_plan.warehouse,
        'truck_number': tlp.truck_number,
        'driver_name': tlp.driver_name,
        'driver_phone': tlp.driver_phone,
        'transporter_name': tlp.transporter_name,
        'status': 'Ready'
    })

    # Copy items from pick plan
    for item in pick_plan.items:
        db.insert('challan_items', {
            'challan_id': challan.id,
            'so_line_id': item.so_line_id,
            'paper': item.material_name,
            'gsm': item.gsm,
            'size': item.size,
            'ordered_qty': item.ordered_qty,
            'picked_qty': item.qty_picked,
            'quantity': item.qty_picked,
            'lot_number': item.lot_number,
            'bin_location': item.bin_location
        })

    return challan
```

#### 2. Status Transition Rules
```python
ALLOWED_TRANSITIONS = {
    'Ready': ['Loading'],
    'Loading': ['Loaded'],
    'Loaded': ['Dispatched'],
    'Dispatched': []  # Terminal state
}

def update_challan_status(challan_id, new_status, data):
    challan = db.get('challans', challan_id)

    if new_status not in ALLOWED_TRANSITIONS[challan.status]:
        raise InvalidTransitionError(
            f"Cannot transition from {challan.status} to {new_status}"
        )

    # Status-specific validations
    if new_status == 'Loading':
        challan.loading_start_time = data['startTime']

    elif new_status == 'Loaded':
        if not challan.loading_start_time:
            raise ValidationError("Must start loading before completing")
        challan.loading_end_time = data['endTime']
        challan.loaded_by = data['loadedBy']
        challan.number_of_bundles = data.get('numberOfBundles')
        challan.weight_kg = data.get('weightKg')

    elif new_status == 'Dispatched':
        dispatch_challan(challan, data)  # Triggers side effects

    challan.status = new_status
    db.save(challan)
```

#### 3. Dispatch Side Effects (Critical)
```python
def dispatch_challan(challan, data):
    """
    On Dispatch, system MUST:
    1. Create In-Transit tracking entry
    2. Lock Pick Plan (no further edits)
    3. Permanently reduce warehouse stock
    4. Enable Sales Invoice generation
    """
    # 1. Create In-Transit Tracking Entry
    tracking = db.insert('in_transit_tracking', {
        'tracking_number': generate_number('TRK'),
        'challan_id': challan.id,
        'truck_number': challan.truck_number,
        'driver_name': challan.driver_name,
        'origin': challan.warehouse,
        'destination': challan.customer_address,
        'delivery_mode': challan.delivery_mode,
        'dispatched_date': data['gateOutTime'],
        'expected_arrival': challan.expected_delivery_date,
        'status': 'Dispatched'
    })
    challan.in_transit_tracking_id = tracking.tracking_number

    # 2. Lock Pick Plan
    db.update('pick_plan_master',
        WHERE={'id': challan.pick_plan_id},
        SET={'status': 'Locked', 'locked_at': datetime.now()}
    )

    # 3. Permanently Reduce Warehouse Stock
    for item in challan.items:
        # Move from Reserved → Dispatched (permanent deduction)
        db.update('stock_lots',
            WHERE={'lot_number': item.lot_number},
            SET={
                'allocated_qty': db.raw('allocated_qty - ?', item.quantity),
                'dispatched_qty': db.raw('dispatched_qty + ?', item.quantity)
            }
        )
        # Update stock reservation status
        db.update('stock_reservation',
            WHERE={
                'pick_plan_id': challan.pick_plan_id,
                'lot_number': item.lot_number
            },
            SET={'status': 'Dispatched'}
        )

    # 4. Enable Sales Invoice
    challan.invoice_eligible = True
    challan.dispatch_time = data['gateOutTime']
    challan.gate_out_time = data['gateOutTime']
    challan.lr_number = data.get('lrNumber')
    challan.eway_bill_number = data.get('eWayBillNumber')
    challan.transport_cost = data.get('transportCost')

    # 5. Update Truck Load Plan status
    db.update('truck_load_plans',
        WHERE={'id': challan.truck_load_plan_id},
        SET={'status': 'Dispatched'}
    )

    # 6. Update SO Line status
    db.update('sales_order_lines',
        WHERE={'id': challan.so_line_id},
        SET={'status': 'Dispatched'}
    )
```

#### 4. Sales Invoice Generation
```python
def generate_sales_invoice(challan_id):
    """
    Generate invoice only when status = Dispatched
    """
    challan = db.get('challans', challan_id)

    if challan.status != 'Dispatched':
        raise ValidationError("Can only generate invoice for dispatched challans")
    if challan.invoice_number:
        raise DuplicateError("Invoice already generated")

    # Pull rates from SO
    so = db.get('sales_orders', challan.so_id)
    invoice_lines = []

    for item in challan.items:
        so_line = db.get('sales_order_lines', item.so_line_id)
        amount = item.quantity * so_line.rate
        gst = amount * 0.18  # 18% GST

        invoice_lines.append({
            'material': item.paper,
            'quantity': item.quantity,
            'rate': so_line.rate,
            'amount': amount,
            'gst': gst,
            'total': amount + gst
        })

    total = sum(l['amount'] for l in invoice_lines)
    total_gst = sum(l['gst'] for l in invoice_lines)

    invoice = db.insert('sales_invoices', {
        'invoice_number': generate_number('INV'),
        'challan_id': challan_id,
        'so_id': challan.so_id,
        'customer': challan.customer_name,
        'total_amount': total,
        'gst_amount': total_gst,
        'grand_total': total + total_gst,
        'status': 'Generated'
    })

    # Update challan with invoice number
    challan.invoice_number = invoice.invoice_number
    db.save(challan)

    # Queue for Tally export
    db.insert('tally_export_queue', {
        'invoice_id': invoice.id,
        'invoice_number': invoice.invoice_number,
        'status': 'Pending',
        'export_type': 'Sales Invoice'
    })

    return invoice
```

#### 5. Backend Linkage Map
On dispatch, Challan must update these linked records:
```
PickPlan.Status        → Locked
TruckLoadPlan.Status   → Dispatched
StockReservation.Status → Dispatched
StockLots              → allocated_qty reduced, dispatched_qty increased
InTransit.Entry        → Created (new tracking record)
SalesInvoice.Eligible  → Set to true
SOLine.Status          → Dispatched
```

All linked via: `SO_ID`, `PickPlan_ID`, `TruckLoadPlan_ID`, `Challan_ID`

### Database Indexes:

```sql
CREATE INDEX idx_challan_status ON challans(status);
CREATE INDEX idx_challan_so ON challans(so_id, so_number);
CREATE INDEX idx_challan_pick_plan ON challans(pick_plan_id);
CREATE INDEX idx_challan_tlp ON challans(truck_load_plan_id);
CREATE INDEX idx_challan_date ON challans(challan_date, status);
CREATE INDEX idx_challan_invoice ON challans(invoice_number);
```

### Advanced Features (Future Phase):

1. **GPS Tracking Link** — Embed live GPS tracking URL from transporter
2. **OTP Confirmation at Delivery** — Generate OTP, verify at unloading
3. **POD Image Upload** — Proof of delivery photo from driver app
4. **Auto Delay Detection** — Compare dispatch_time + estimated_transit_time vs actual delivery
5. **Seal Number Management** — Unique seal per challan, verify at delivery
6. **Digital Signature Capture** — Customer sign on delivery for POD
7. **Quality Check Before Loading** — Verify material matches pick plan before loading starts

---

## 10. Truck Load Plan

### Frontend Status: ✅ Fully Implemented with Critical Architecture Fix

**Location:** `frontend/app/truck-load-plan/page.tsx`, `frontend/components/forms/TruckLoadPlanForm.tsx`

### Features Implemented:
- ✅ **Source Selection:** Mill Ready Material vs In-house Stock (NO manual entry)
- ✅ **Item Selection Grid:** Checkbox selection from ready inventory only
- ✅ **Auto-calculations:** Weight (MT), Load utilization %
- ✅ **Drop Points Auto-grouping:** By destination
- ✅ **Truck Details:** Number, Driver, Transporter, Capacity
- ✅ **Route Planning:** Origin, destinations, dates
- ✅ **Overload/Underload Warnings**

### Backend APIs Needed:

#### GET `/api/truck-load-plan/available-items`
Get items ready for truck planning

**Query Params:**
```
?source=mill | stock
```

**Response:**
```json
{
  "millItems": [
    {
      "id": "mt_001",
      "poNumber": "PO-2026-001",
      "soNumber": "SO-2026-001",
      "material": "Maplitho 80 GSM 23x36",
      "gsm": 80,
      "size": "23x36",
      "availableQty": 7000,
      "destination": "ABC Printers Factory",
      "deliveryMode": "Direct To Customer"
    }
  ],
  "stockItems": [
    {
      "id": "lot_001",
      "lotNumber": "LOT-2024-001",
      "material": "Maplitho 80 GSM 23x36",
      "availableQty": 5000,
      "binLocation": "Lasudia-A-1-A1"
    }
  ]
}
```

#### POST `/api/truck-load-plans`
Create truck load plan

**Request:**
```json
{
  "planNumber": "TLP-2026-0001",
  "planDate": "2026-02-15",
  "source": "mill | stock",
  "items": [
    {
      "sourceId": "mt_001",
      "sourceType": "mill",
      "material": "Maplitho 80 GSM 23x36",
      "quantity": 7000,
      "weightMT": 6.3,
      "destination": "ABC Printers Factory"
    }
  ],
  "truckNumber": "MP09AB1234",
  "truckCapacity": 10,
  "driverName": "Ramesh Kumar",
  "driverPhone": "9876543210",
  "transporterName": "XYZ Logistics",
  "origin": "Lasudia Godown",
  "dropPoints": [
    {
      "sequence": 1,
      "destination": "ABC Printers Factory",
      "qty": 7000,
      "estimatedArrival": "2026-02-16T10:00:00Z"
    }
  ],
  "plannedLoadDate": "2026-02-15",
  "estimatedDispatch": "2026-02-15T14:00:00Z",
  "totalWeightMT": 6.3,
  "loadUtilization": 63
}
```

**Response:**
```json
{
  "id": "tlp_001",
  "planNumber": "TLP-2026-0001",
  "status": "Planned",
  "overloadWarning": false,
  "underloadWarning": true,
  "message": "Truck is only 63% loaded. Consider adding more items."
}
```

#### PATCH `/api/truck-load-plans/{id}/dispatch`
Mark truck as dispatched

**Request:**
```json
{
  "dispatchDate": "2026-02-15T14:30:00Z",
  "dispatchedBy": "Warehouse Manager",
  "lrNumber": "LR-12345",
  "challanNumbers": ["CHL-2026-0001", "CHL-2026-0002"]
}
```

**Response:**
```json
{
  "status": "Dispatched",
  "trackingNumber": "TRK-2026-0001",
  "inTransitRecordCreated": true
}
```

### Business Logic Required:

1. **Auto-numbering:** `TLP-YYYY-NNNN`
2. **Source Validation:**
   - **Mill Source:** Only items from Mill Tracker with `readyQty > 0` and `productionStatus = 'Ready'`
   - **Stock Source:** Only items from Stock Lots with `availableQty > 0`
   - **NEVER allow manual material entry**
3. **Weight Calculation:**
   ```python
   weightMT = (gsm * length_cm * width_cm * quantity) / 10000000
   ```
4. **Load Utilization:**
   ```python
   utilization = (totalWeightMT / truckCapacity) * 100
   if utilization > 100: raise OverloadWarning()
   if utilization < 70: show UnderloadWarning()
   ```
5. **Drop Points Auto-grouping:**
   ```python
   drop_points = group_by(items, 'destination')
   for idx, (dest, items) in enumerate(drop_points):
       sequence = idx + 1
       qty = sum(item.quantity for item in items)
   ```
6. **Status on Dispatch:**
   - Update Mill Tracker: `status = 'Dispatched'` (if source = mill)
   - Update Stock Lots: `availableQty -= qty` (if source = stock)
   - Create `InTransitTracking` record
   - Link to Challan(s)

---

## 11. In-Transit Tracking

### Frontend Status: ✅ Fully Implemented with Advanced Features

**Location:** `frontend/app/in-transit/page.tsx`

### Features Implemented:
- ✅ **Status Lifecycle:** Loading → Dispatched → In Transit → Reached → Unloading → Delivered → Delayed
- ✅ **Manual Status Update Modal:** Status, Location, Remarks, Photo upload
- ✅ **Bulk Update via Excel:** Template download, batch status updates
- ✅ **ETA Logic:** Auto-calculated, overdue in red
- ✅ **Days in Transit:** Color-coded (0-1 green, 2 yellow, 3+ red)
- ✅ **Overdue KPI Card**
- ✅ **Document Upload:** POD, LR Copy, Delivery Photos
- ✅ **Drop Details Modal:** Full timeline with location updates

### Backend APIs Needed:

#### POST `/api/in-transit`
Create tracking record (auto from Truck Load Plan dispatch)

**Request:**
```json
{
  "loadPlanId": "tlp_001",
  "truckNumber": "MP09AB1234",
  "driverName": "Ramesh Kumar",
  "driverPhone": "9876543210",
  "origin": "Lasudia Godown",
  "destination": "ABC Printers Factory",
  "deliveryMode": "Direct To Customer",
  "challanNumbers": ["CHL-2026-0001"],
  "poNumber": "PO-2026-001",
  "soNumber": "SO-2026-001",
  "dispatchedDate": "2026-02-15",
  "expectedArrival": "2026-02-16"
}
```

**Response:**
```json
{
  "id": "it_001",
  "trackingNumber": "TRK-2026-0001",
  "status": "Dispatched",
  "createdAt": "2026-02-15T14:30:00Z"
}
```

#### PATCH `/api/in-transit/{id}/update-status`
Update shipment status

**Request:**
```json
{
  "status": "In Transit | Reached Destination | Unloading | Delivered | Delayed",
  "currentLocation": "Toll Plaza, NH-12",
  "remarks": "Traffic delay, ETA revised to 6 PM",
  "photoUrl": "https://storage.monit.com/photos/location1.jpg",
  "updatedBy": "Driver | Manager | System"
}
```

**Response:**
```json
{
  "trackingNumber": "TRK-2026-0001",
  "status": "In Transit",
  "locationUpdates": [
    {
      "timestamp": "2026-02-15T16:00:00Z",
      "location": "Toll Plaza, NH-12",
      "remarks": "Traffic delay, ETA revised to 6 PM"
    }
  ]
}
```

#### POST `/api/in-transit/bulk-update`
Bulk update from Excel

**Request:** (Multipart form-data)
```
file: Excel file
columns: Tracking No, Status, Location, Remarks, Date
```

**Response:**
```json
{
  "totalRows": 50,
  "successCount": 48,
  "failedCount": 2,
  "errors": [
    {
      "row": 15,
      "trackingNumber": "TRK-2026-0025",
      "error": "Invalid status value"
    }
  ]
}
```

#### POST `/api/in-transit/{id}/upload-pod`
Upload POD documents

**Request:** (Multipart form-data)
```
podFile: PDF/Image
lrCopy: PDF/Image
photos[]: Multiple images
```

**Response:**
```json
{
  "trackingNumber": "TRK-2026-0001",
  "documents": {
    "pod": "https://storage.monit.com/pod/TRK-2026-0001.pdf",
    "lr": "https://storage.monit.com/lr/TRK-2026-0001.pdf",
    "photos": [
      "https://storage.monit.com/photos/delivery1.jpg",
      "https://storage.monit.com/photos/delivery2.jpg"
    ]
  },
  "uploadedAt": "2026-02-16T11:00:00Z"
}
```

### Business Logic Required:

1. **Status Transitions:**
   ```python
   allowed_transitions = {
       'Dispatched': ['In Transit', 'Delayed'],
       'In Transit': ['Reached Destination', 'Delayed'],
       'Reached Destination': ['Unloading'],
       'Unloading': ['Delivered', 'Delayed'],
       'Delayed': ['In Transit', 'Reached Destination']
   }
   ```
2. **Overdue Detection:**
   ```python
   if today > expected_arrival and status != 'Delivered':
       is_overdue = True
       alert_logistics_team()
   ```
3. **Days in Transit:**
   ```python
   days = (today - dispatchedDate).days
   ```
4. **Delivery Confirmation Logic:**
   - **If Delivery Mode = Direct To Customer:**
     - Update SO Line: `status = 'Delivered'`
     - Reduce `stockAllocated` from SO
     - Mark order complete if all lines delivered
   - **If Delivery Mode = To Godown:**
     - Create GRN (Goods Receipt Note)
     - Increase godown stock
     - Update bin locations
5. **Bulk Update Processing:**
   - Parse Excel file
   - Validate tracking numbers exist
   - Validate status transitions
   - Update in batch
   - Return error report for failed rows

---

## 12. GRN (Goods Receipt Note) — Inventory Entry Gate

### Frontend Status: ✅ Fully Implemented

**Location:** `frontend/app/grn/page.tsx`

### What GRN Does:
GRN is the **entry gate to inventory**. Nothing enters stock without a GRN. It is the bridge between:
- **Mill/Transporter** → **Warehouse** → **Stock Lots** → **FIFO Availability**

### Features Implemented (Frontend):
- ✅ KPI Dashboard (Draft, QC Pending, Approved, Stock Updated, Discrepancy, Total Received, Short Supply)
- ✅ Visual status flow bar (Draft → QC Pending → Approved → Stock Updated)
- ✅ PO Ordered vs Received quantity tracking with partial delivery handling
- ✅ Transport & logistics details (Mill Challan, LR Number, Vehicle, Transporter)
- ✅ Weight-based tracking (Received Weight MT, Expected Weight, Variance %)
- ✅ Structured Quality Check (Condition + QC Result + Remarks)
- ✅ Auto lot number generation (Mill-Paper-GSM-Size-Date-Seq format)
- ✅ Auto bin allocation suggestion
- ✅ GRN Detail Modal with 6 sections (Header, Quantity, Transport, QC, Bin/Lot, Linked Status)
- ✅ Status transition buttons with auto-discrepancy detection
- ✅ Mill Order Tracker linkage indicator

### Database Schema:

#### `grn_master` Table
```sql
CREATE TABLE grn_master (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number      VARCHAR(20) UNIQUE NOT NULL,     -- GRN-YYYY-NNNN
    po_id           UUID NOT NULL REFERENCES purchase_orders(id),
    po_number       VARCHAR(20) NOT NULL,
    in_transit_id   UUID REFERENCES in_transit(id),

    -- Mill & Material
    mill            VARCHAR(100) NOT NULL,
    paper_type      VARCHAR(100) NOT NULL,
    gsm             INTEGER NOT NULL,
    size            VARCHAR(50) NOT NULL,

    -- Quantity Tracking
    ordered_qty     INTEGER NOT NULL,                 -- From PO
    previously_received_qty INTEGER NOT NULL DEFAULT 0, -- Sum of prior GRNs for same PO
    received_qty    INTEGER NOT NULL,                 -- This GRN
    short_qty       INTEGER NOT NULL DEFAULT 0,       -- ordered - previously_received - received
    damaged_qty     INTEGER NOT NULL DEFAULT 0,
    balance_qty     INTEGER NOT NULL DEFAULT 0,       -- Remaining to be received on PO

    -- Weight Tracking (future-ready)
    received_weight_mt  DECIMAL(10,3),                -- Metric Tons
    expected_weight_mt  DECIMAL(10,3),

    -- Warehouse & Location
    warehouse       VARCHAR(100) NOT NULL,
    bin_location    VARCHAR(50),                       -- Assigned bin
    suggested_bin   VARCHAR(50),                       -- System-suggested bin
    lot_number      VARCHAR(100),                      -- Auto-generated: Mill-Paper-GSM-Size-Date-Seq

    -- Transport & Logistics
    mill_challan_number VARCHAR(50),
    lr_number       VARCHAR(50),
    transporter     VARCHAR(100),
    vehicle_number  VARCHAR(20),
    received_by     VARCHAR(100),
    unloading_start_time TIMESTAMP,
    unloading_end_time   TIMESTAMP,

    -- Quality Check
    condition       VARCHAR(20) NOT NULL DEFAULT 'Good',  -- Good | Slight Damage | Wet | Torn | Mixed GSM
    qc_result       VARCHAR(30),                          -- Accepted | Accepted with Remark | Rejected | Hold
    quality_grade   VARCHAR(10) DEFAULT 'A',              -- A | B | C
    qc_approved_by  VARCHAR(100),
    qc_date         TIMESTAMP,
    remarks         TEXT,

    -- Status & Linkage
    status          VARCHAR(20) NOT NULL DEFAULT 'Draft', -- Draft | QC Pending | Approved | Stock Updated | Discrepancy Raised
    mill_tracker_updated BOOLEAN DEFAULT FALSE,
    received_date   DATE NOT NULL,

    -- Audit
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    created_by      UUID REFERENCES users(id)
);

-- Performance indexes
CREATE INDEX idx_grn_status ON grn_master(status);
CREATE INDEX idx_grn_po ON grn_master(po_id);
CREATE INDEX idx_grn_mill ON grn_master(mill);
CREATE INDEX idx_grn_warehouse ON grn_master(warehouse);
CREATE INDEX idx_grn_received_date ON grn_master(received_date);
CREATE INDEX idx_grn_lot_number ON grn_master(lot_number);
```

#### `grn_status_log` Table
```sql
CREATE TABLE grn_status_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id      UUID NOT NULL REFERENCES grn_master(id),
    from_status VARCHAR(20),
    to_status   VARCHAR(20) NOT NULL,
    changed_by  UUID REFERENCES users(id),
    remarks     TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);
```

### Backend APIs:

#### 1. GET `/api/grn`
List all GRNs with filters and pagination.

**Query Params:** `status`, `mill`, `warehouse`, `poNumber`, `fromDate`, `toDate`, `page`, `limit`

**Response:**
```json
{
  "data": [
    {
      "id": "grn_001",
      "grnNumber": "GRN-2026-0001",
      "poNumber": "PO-2026-001",
      "mill": "ITC",
      "paperType": "FBB",
      "gsm": 300,
      "size": "23x36",
      "orderedQty": 10000,
      "previouslyReceivedQty": 0,
      "receivedQty": 9800,
      "shortQty": 200,
      "damagedQty": 0,
      "balanceQty": 0,
      "warehouse": "Lasudia",
      "condition": "Good",
      "qcResult": "Accepted",
      "lotNumber": "ITC-FBB-300-23x36-20260214-01",
      "status": "Stock Updated",
      "receivedDate": "2026-02-14"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

#### 2. GET `/api/grn/:id`
Get full GRN detail including transport, QC, and linked records.

**Response:**
```json
{
  "id": "grn_001",
  "grnNumber": "GRN-2026-0001",
  "poNumber": "PO-2026-001",
  "inTransitId": "it_001",
  "mill": "ITC",
  "paperType": "FBB",
  "gsm": 300,
  "size": "23x36",
  "orderedQty": 10000,
  "previouslyReceivedQty": 0,
  "receivedQty": 9800,
  "shortQty": 200,
  "damagedQty": 0,
  "balanceQty": 0,
  "receivedWeightMT": 2.45,
  "expectedWeightMT": 2.50,
  "warehouse": "Lasudia",
  "binLocation": "Lasudia-A-1-A1",
  "suggestedBin": "Lasudia-A-1-A1",
  "lotNumber": "ITC-FBB-300-23x36-20260214-01",
  "millChallanNumber": "MC-ITC-2026-001",
  "lrNumber": "LR-2026-001",
  "transporter": "ABC Transport",
  "vehicleNumber": "MP09AB1234",
  "receivedBy": "Rajesh Kumar",
  "unloadingStartTime": "2026-02-14T09:00:00",
  "unloadingEndTime": "2026-02-14T10:30:00",
  "condition": "Good",
  "qcResult": "Accepted",
  "qualityGrade": "A",
  "qcApprovedBy": "QC Manager",
  "remarks": "",
  "status": "Stock Updated",
  "millTrackerUpdated": true,
  "receivedDate": "2026-02-14",
  "statusLog": [
    { "fromStatus": null, "toStatus": "Draft", "changedBy": "System", "date": "2026-02-14T08:30:00" },
    { "fromStatus": "Draft", "toStatus": "QC Pending", "changedBy": "Warehouse Operator", "date": "2026-02-14T09:00:00" },
    { "fromStatus": "QC Pending", "toStatus": "Approved", "changedBy": "QC Manager", "date": "2026-02-14T11:00:00" },
    { "fromStatus": "Approved", "toStatus": "Stock Updated", "changedBy": "System", "date": "2026-02-14T11:05:00" }
  ]
}
```

#### 3. POST `/api/grn`
Create a new GRN (typically from In-Transit delivery arrival).

**Request:**
```json
{
  "poId": "po_001",
  "poNumber": "PO-2026-001",
  "inTransitId": "it_001",
  "mill": "ITC",
  "paperType": "FBB",
  "gsm": 300,
  "size": "23x36",
  "orderedQty": 10000,
  "receivedQty": 9800,
  "damagedQty": 0,
  "receivedWeightMT": 2.45,
  "expectedWeightMT": 2.50,
  "warehouse": "Lasudia",
  "millChallanNumber": "MC-ITC-2026-001",
  "lrNumber": "LR-2026-001",
  "transporter": "ABC Transport",
  "vehicleNumber": "MP09AB1234",
  "receivedBy": "Rajesh Kumar",
  "receivedDate": "2026-02-14",
  "remarks": ""
}
```

**Backend auto-calculates:**
- `previouslyReceivedQty` = SUM of `received_qty` from prior GRNs for same PO
- `shortQty` = `orderedQty - previouslyReceivedQty - receivedQty`
- `balanceQty` = `orderedQty - previouslyReceivedQty - receivedQty`
- `suggestedBin` = auto-suggest from available bins in warehouse
- `status` = `Draft`

**Response:** Full GRN object with auto-generated `grnNumber`

#### 4. PUT `/api/grn/:id/submit-qc`
Submit GRN for Quality Check (Draft → QC Pending).

**Request:**
```json
{
  "condition": "Good",
  "remarks": "All sheets in good condition"
}
```

**Validations:**
- GRN must be in `Draft` status
- `receivedQty` must be > 0

#### 5. PUT `/api/grn/:id/approve-qc`
QC Manager approves the GRN (QC Pending → Approved or Discrepancy Raised).

**Request:**
```json
{
  "qcResult": "Accepted",
  "qualityGrade": "A",
  "remarks": "Quality verified, all parameters within spec"
}
```

**Auto-routing Logic:**
```python
def approve_qc(grn, qc_result, quality_grade, remarks):
    grn.qc_result = qc_result
    grn.quality_grade = quality_grade
    grn.qc_approved_by = current_user
    grn.qc_date = now()

    # Auto-route to Discrepancy if issues found
    has_discrepancy = (
        grn.short_qty > 0 or
        grn.damaged_qty > 0 or
        qc_result in ['Rejected', 'Hold']
    )

    if has_discrepancy:
        grn.status = 'Discrepancy Raised'
        # Trigger discrepancy notification to Purchase team
        notify_purchase_team(grn, reason='QC Discrepancy')
    else:
        grn.status = 'Approved'

    log_status_change(grn)
```

#### 6. PUT `/api/grn/:id/update-stock`
Create stock lot and update inventory (Approved → Stock Updated).

**Request:**
```json
{
  "binLocation": "Lasudia-A-1-A1",
  "lotNumber": "ITC-FBB-300-23x36-20260214-01"
}
```

**Side Effects — This is the critical endpoint:**
```python
def update_stock(grn, bin_location, lot_number):
    # 1. Validate GRN is Approved
    assert grn.status == 'Approved'

    # 2. Create Stock Lot
    stock_lot = create_stock_lot(
        lot_number=lot_number,          # Auto-generated or confirmed
        material_id=grn.material_id,
        mill=grn.mill,
        paper_type=grn.paper_type,
        gsm=grn.gsm,
        size=grn.size,
        qty=grn.received_qty - grn.damaged_qty,  # Only good qty
        bin_location=bin_location,
        warehouse=grn.warehouse,
        grn_id=grn.id,
        grn_date=grn.received_date,     # CRITICAL: Used for FIFO ordering
        status='Available'
    )

    # 3. Update Bin Location occupancy
    update_bin_occupancy(bin_location, qty=stock_lot.qty, action='add')

    # 4. Update Inventory totals
    update_inventory(
        material=grn.material_id,
        warehouse=grn.warehouse,
        qty_change=stock_lot.qty,
        action='inward'
    )

    # 5. Update Mill Tracker → "Delivered"
    if grn.in_transit_id:
        update_mill_tracker(grn.po_id, status='Delivered')
        grn.mill_tracker_updated = True

    # 6. Update PO received quantities
    update_po_received_qty(grn.po_id, grn.received_qty)
    # If fully received: PO status → 'Completed'
    # If partially received: PO status → 'Partially Received'

    # 7. Make stock available for Coverage/FIFO/Pick Plan
    # Stock lot with status='Available' is now:
    #   - Visible in Coverage Engine for order allocation
    #   - Available for FIFO pick in Pick Plan
    #   - Counted in inventory reports

    # 8. Update GRN status
    grn.status = 'Stock Updated'
    grn.bin_location = bin_location
    grn.lot_number = lot_number
    log_status_change(grn)

    return stock_lot
```

#### 7. PUT `/api/grn/:id/resolve-discrepancy`
Resolve a discrepancy (Discrepancy Raised → Approved, after investigation).

**Request:**
```json
{
  "resolution": "Short supply confirmed. Debit note raised to mill.",
  "adjustedReceivedQty": 9500,
  "adjustedDamagedQty": 300,
  "debitNoteRequired": true
}
```

#### 8. GET `/api/grn/po/:poId/history`
Get all GRNs for a PO (for partial delivery tracking).

**Response:**
```json
{
  "poNumber": "PO-2026-001",
  "orderedQty": 10000,
  "totalReceivedQty": 7500,
  "balanceQty": 2500,
  "grns": [
    { "grnNumber": "GRN-2026-0001", "receivedQty": 5000, "date": "2026-02-10", "status": "Stock Updated" },
    { "grnNumber": "GRN-2026-0005", "receivedQty": 2500, "date": "2026-02-14", "status": "QC Pending" }
  ]
}
```

### Business Logic — Critical Algorithms:

#### Algorithm 1: Auto Lot Number Generation
```python
def generate_lot_number(mill, paper_type, gsm, size, received_date):
    """
    Format: Mill-Paper-GSM-Size-Date-Seq
    Example: ITC-FBB-300-23x36-20260214-01
    """
    date_str = received_date.strftime('%Y%m%d')
    base = f"{mill}-{paper_type}-{gsm}-{size}-{date_str}"

    # Get sequence for today
    existing_count = count_lots_with_prefix(base)
    seq = str(existing_count + 1).zfill(2)

    return f"{base}-{seq}"
```

#### Algorithm 2: Auto Bin Suggestion
```python
def suggest_bin(warehouse, paper_type, gsm, size):
    """
    Suggest the best available bin based on:
    1. Same material already stored (group similar items)
    2. Available capacity
    3. Zone preference (heavy items near dock)
    """
    # Priority 1: Bin already storing same material
    same_material_bins = find_bins_with_material(
        warehouse=warehouse,
        paper_type=paper_type,
        gsm=gsm,
        size=size,
        has_capacity=True
    )
    if same_material_bins:
        return same_material_bins[0]  # Closest match with capacity

    # Priority 2: Empty bin in preferred zone
    empty_bins = find_empty_bins(warehouse=warehouse)
    if empty_bins:
        # Sort by zone preference (heavy GSM near dock)
        if gsm >= 300:
            return sort_by_dock_proximity(empty_bins)[0]
        return empty_bins[0]

    # Priority 3: Any bin with capacity
    available_bins = find_bins_with_capacity(warehouse=warehouse)
    return available_bins[0] if available_bins else None
```

#### Algorithm 3: Partial Delivery Tracking
```python
def calculate_delivery_status(po_id):
    """
    Track PO fulfillment across multiple GRNs.
    """
    po = get_purchase_order(po_id)
    grns = get_grns_for_po(po_id, status__in=['Approved', 'Stock Updated'])

    total_received = sum(g.received_qty for g in grns)
    total_damaged = sum(g.damaged_qty for g in grns)
    good_qty = total_received - total_damaged
    balance = po.ordered_qty - total_received

    if balance <= 0:
        po.delivery_status = 'Fully Received'
    elif total_received > 0:
        po.delivery_status = 'Partially Received'
        po.received_percentage = (total_received / po.ordered_qty) * 100
    else:
        po.delivery_status = 'Pending'

    return {
        'orderedQty': po.ordered_qty,
        'totalReceived': total_received,
        'totalDamaged': total_damaged,
        'goodQty': good_qty,
        'balanceQty': balance,
        'deliveryPercentage': round((total_received / po.ordered_qty) * 100, 1)
    }
```

#### Algorithm 4: QC Workflow with Auto-Discrepancy Detection
```python
def process_qc_approval(grn_id, qc_result, quality_grade, remarks):
    """
    QC approval automatically detects discrepancies and routes accordingly.
    """
    grn = get_grn(grn_id)
    assert grn.status == 'QC Pending'

    grn.qc_result = qc_result
    grn.quality_grade = quality_grade
    grn.qc_approved_by = current_user
    grn.qc_date = now()
    grn.remarks = remarks

    # Discrepancy conditions (ANY triggers discrepancy)
    discrepancy_reasons = []

    if grn.short_qty > 0:
        discrepancy_reasons.append(f"Short supply: {grn.short_qty} sheets")

    if grn.damaged_qty > 0:
        discrepancy_reasons.append(f"Damaged: {grn.damaged_qty} sheets ({grn.condition})")

    if qc_result == 'Rejected':
        discrepancy_reasons.append(f"QC Rejected: {remarks}")

    if qc_result == 'Hold':
        discrepancy_reasons.append(f"QC Hold: Pending further inspection")

    # Weight variance check (if weight data available)
    if grn.received_weight_mt and grn.expected_weight_mt:
        variance = abs(grn.received_weight_mt - grn.expected_weight_mt) / grn.expected_weight_mt * 100
        if variance > 5:  # >5% weight variance
            discrepancy_reasons.append(f"Weight variance: {variance:.1f}%")

    if discrepancy_reasons:
        grn.status = 'Discrepancy Raised'
        create_discrepancy_record(grn, discrepancy_reasons)
        notify_purchase_team(grn, discrepancy_reasons)
    else:
        grn.status = 'Approved'

    log_status_change(grn)
    return grn
```

#### Algorithm 5: Stock Update Cascade (What Happens After GRN)
```python
def grn_stock_update_cascade(grn_id):
    """
    After GRN is approved and stock updated, this cascade ensures:
    1. Stock lot is created with FIFO date = GRN received date
    2. Inventory is updated
    3. Coverage engine can now allocate this stock
    4. Pick Plan FIFO queue includes this lot
    5. Mill tracker is updated
    """
    grn = get_grn(grn_id)

    # Step 1: Create Stock Lot
    lot = create_stock_lot(
        lot_number=grn.lot_number,
        qty=grn.received_qty - grn.damaged_qty,
        grn_date=grn.received_date,  # FIFO ordering key
        status='Available'
    )

    # Step 2: The lot is now automatically:
    # - Visible in GET /api/inventory (stock listing)
    # - Available in Coverage Engine (GET /api/coverage/available-stock)
    # - In FIFO queue ordered by grn_date (oldest first)
    # - Pickable in Pick Plan (GET /api/pick-plan/available-lots)
    # - Counted in Sales Invoice qty validation

    # Step 3: Update Mill Tracker
    if grn.in_transit_id:
        mill_tracker = get_mill_tracker_by_po(grn.po_id)
        mill_tracker.status = 'Delivered'
        mill_tracker.actual_delivery_date = grn.received_date

    # Step 4: Check if PO is fully received
    po_status = calculate_delivery_status(grn.po_id)
    if po_status['balanceQty'] <= 0:
        update_po_status(grn.po_id, 'Completed')
    else:
        update_po_status(grn.po_id, 'Partially Received')

    return lot
```

### Status Flow:

```
Draft → QC Pending → Approved → Stock Updated
                  ↘ Discrepancy Raised → (Resolve) → Approved → Stock Updated
```

**Transition Rules:**
| From | To | Trigger | Who |
|------|-----|---------|-----|
| Draft | QC Pending | Submit for QC | Warehouse Operator |
| QC Pending | Approved | QC passes, no discrepancy | QC Manager |
| QC Pending | Discrepancy Raised | Short/Damaged/Rejected/Hold/Weight variance | QC Manager (auto) |
| Discrepancy Raised | Approved | Discrepancy resolved | Purchase Manager |
| Approved | Stock Updated | Create lot + update inventory | System (auto after approval) or Warehouse Manager |

### Backend Linkage Map:

```
PurchaseOrder.ordered_qty    → GRN.ordered_qty (reference)
PurchaseOrder.status         → Updated to 'Partially Received' / 'Completed'
InTransit.status             → Updated to 'Delivered' on GRN creation
MillTracker.status           → Updated to 'Delivered' on Stock Update
StockLot.grn_date            → Used for FIFO ordering (oldest first)
StockLot.status='Available'  → Visible to Coverage Engine
StockLot.status='Available'  → Pickable in Pick Plan (FIFO)
BinLocation.occupied_qty     → Updated on stock update
Inventory.total_qty          → Updated on stock update
```

### Validation Rules:
1. `receivedQty` must be ≤ `orderedQty - previouslyReceivedQty`
2. `damagedQty` must be ≤ `receivedQty`
3. Cannot submit for QC if `receivedQty = 0`
4. Cannot update stock if QC result is `Rejected` or `Hold`
5. Lot number must be unique across system
6. Bin location must exist and have capacity
7. One PO can have multiple GRNs (partial delivery)
8. Weight variance > 5% auto-flags discrepancy

### Advanced Features (Future):
- **Barcode/QR scanning** for material identification
- **Photo capture** for damage documentation
- **Auto GRN from In-Transit** when transporter marks delivered
- **Supplier scorecard** based on GRN quality/shortage history
- **Debit note auto-generation** for damaged/short shipments
- **Weighbridge integration** for automatic weight capture
- **Mobile GRN** for warehouse floor scanning

---

## 13. Master Data

### Frontend Status: ✅ Fully Implemented

**Location:** `frontend/app/masters/*`

### Masters Implemented:
1. ✅ **Materials** - Paper types, GSM, sizes, categories
2. ✅ **Mills** - Mill vendors, locations, lead times
3. ✅ **Locations** - Customer/warehouse locations
4. ✅ **Categories** - Material categories
5. ✅ **Sizes** - Standard paper sizes
6. ✅ **Salesmen** - Sales team members
7. ✅ **Transporters** - Logistics partners
8. ✅ **HSN Codes** - HSN codes with GST / CGST / SGST / IGST breakdown
9. ✅ **Instructions** - Instruction sets per mill, used in PO special instructions
10. ✅ **Localities** - Area/locality master for customer filtering

---

### New API: Instructions Master

**Base URL:** `/api/v1/masters/instructions`

#### GET `/api/v1/masters/instructions`
Returns paginated list.
```json
{
  "items": [
    {
      "id": 1,
      "title": "Standard Mill Instructions",
      "applicableTo": "All",
      "millIds": [],
      "millNames": [],
      "lines": [
        "All consignments must include full mill test report.",
        "Delivery on confirmed slots only — call before dispatch."
      ],
      "isActive": true,
      "createdAt": "2026-01-10T00:00:00Z"
    }
  ],
  "total": 1, "page": 1, "pageSize": 200
}
```

#### POST `/api/v1/masters/instructions`
```json
{
  "title": "Blind Shipment Set",
  "applicableTo": "Specific",
  "millIds": [2, 5],
  "lines": ["Invoice to Monit Paper only.", "No direct customer contact."]
}
```
Response: `201 Created` with the created `InstructionRow`.

#### PUT `/api/v1/masters/instructions/{id}`
```json
{
  "title": "Updated Title",
  "applicableTo": "All",
  "millIds": [],
  "lines": ["Updated instruction line."],
  "isActive": true
}
```

#### DELETE `/api/v1/masters/instructions/{id}`
Response: `204 No Content`

#### GET `/api/v1/masters/instructions/by-mill?millId=3`
Returns all active instruction sets where `applicableTo = "All"` OR `millId` is in `millIds`.
Used by the PO form to auto-populate special instructions when a mill is selected.
```json
[
  { "id": 1, "title": "Standard Mill Instructions", "millIds": [], "lines": ["..."] },
  { "id": 4, "title": "Premium Mill Set", "millIds": [3, 7], "lines": ["..."] }
]
```

**DB Schema:**
```sql
CREATE TABLE Instructions (
  Id           INT IDENTITY PRIMARY KEY,
  Title        NVARCHAR(200) NOT NULL,
  ApplicableTo NVARCHAR(20)  NOT NULL DEFAULT 'All',  -- 'All' | 'Specific'
  Lines        NVARCHAR(MAX) NOT NULL,                -- JSON array of strings
  IsActive     BIT           NOT NULL DEFAULT 1,
  CreatedAt    DATETIME2     NOT NULL DEFAULT GETUTCDATE()
);
CREATE TABLE InstructionMills (
  InstructionId INT NOT NULL REFERENCES Instructions(Id) ON DELETE CASCADE,
  MillId        INT NOT NULL REFERENCES Mills(Id),
  PRIMARY KEY (InstructionId, MillId)
);
```

---

### New API: Localities Master

**Base URL:** `/api/v1/masters/localities`

#### GET `/api/v1/masters/localities`
Returns paginated list.
```json
{
  "items": [
    {
      "id": 1,
      "name": "Vijay Nagar",
      "city": "Indore",
      "state": "Madhya Pradesh",
      "description": null,
      "isActive": true,
      "createdAt": "2026-01-10T00:00:00Z"
    }
  ],
  "total": 1, "page": 1, "pageSize": 200
}
```

#### POST `/api/v1/masters/localities`
```json
{ "name": "Scheme 54", "city": "Indore", "state": "Madhya Pradesh", "description": null }
```
Response: `201 Created` with the created `LocalityRow`.

#### PUT `/api/v1/masters/localities/{id}`
```json
{ "name": "Scheme 54", "city": "Indore", "state": "Madhya Pradesh", "description": "Near Palasia", "isActive": true }
```

#### DELETE `/api/v1/masters/localities/{id}`
Response: `204 No Content`

#### GET `/api/v1/masters/localities/dropdown`
Returns `[{ "id": 1, "name": "Vijay Nagar", "city": "Indore" }, ...]` — active only.

**DB Schema:**
```sql
CREATE TABLE Localities (
  Id          INT IDENTITY PRIMARY KEY,
  Name        NVARCHAR(150) NOT NULL,
  City        NVARCHAR(100) NOT NULL,
  State       NVARCHAR(100) NULL,
  Description NVARCHAR(500) NULL,
  IsActive    BIT           NOT NULL DEFAULT 1,
  CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
);
```

**Customer table change:** Add `LocalityId INT NULL REFERENCES Localities(Id)` to the `Customers` table.

---

### Updated API: HSN Codes — CGST / SGST / IGST

The HSN API response now includes computed tax breakdown fields. **No new DB columns needed** — these are computed from `GstPercent`.

**Updated response shape for `HsnCodeRow` and `HsnCodeDropdown`:**
```json
{
  "id": 1,
  "code": "4802",
  "description": "Uncoated writing/printing paper",
  "gstPercent": 18,
  "cgstPercent": 9,
  "sgstPercent": 9,
  "igstPercent": 18,
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00Z"
}
```

**Computation rules (mandated by Indian GST law):**
- `cgstPercent = gstPercent / 2` — Central GST (intra-state transactions)
- `sgstPercent = gstPercent / 2` — State GST (intra-state transactions)
- `igstPercent = gstPercent` — Integrated GST (inter-state transactions)
- CGST + SGST always equals IGST for any given HSN code

**Backend implementation:** In the API response mapping, always compute and return all four fields. No schema change needed.

---

### Backend APIs Needed:

#### Materials CRUD

**GET `/api/materials`**
```json
{
  "data": [
    {
      "id": "mat_001",
      "code": "ITC/MAP/80/23x36/SHT",
      "mill": "ITC Paperboards",
      "category": "Maplitho",
      "gsm": 80,
      "size": "23x36",
      "packingType": "Sheet",
      "unit": "Sheet | KG",
      "baseRate": 450,
      "isActive": true
    }
  ]
}
```

**POST `/api/materials`** - Create
**PATCH `/api/materials/{id}`** - Update
**DELETE `/api/materials/{id}`** - Soft delete

---

## 🚀 Implementation Priority

### Phase 1 (Critical - Week 1-2):
1. ✅ Sales Orders API
2. ✅ Coverage Engine
3. ✅ Stock Management API
4. ✅ Purchase Orders API

### Phase 2 (High Priority - Week 3-4):
5. ✅ Dispatch Queue API
6. ✅ Pick Plan API
7. ✅ Challan Generation
8. ✅ Mill Tracker API

### Phase 3 (Medium Priority - Week 5-6):
9. ✅ Truck Load Plan API
10. ✅ In-Transit Tracking API
11. ✅ GRN API
12. ✅ Customer Inquiry API

### Phase 4 (Enhancement - Week 7-8):
13. ✅ Bulk Update Features
14. ✅ Document Management (POD, LR uploads)
15. ✅ Reporting APIs
16. ✅ Analytics & Dashboards

---

## 🔐 Security & Authorization

### Role-Based Access Control (RBAC):

1. **Admin:** Full access to all modules
2. **Sales Team:** Inquiries, SO, Customers
3. **Purchase Team:** PO, Mill Tracker
4. **Warehouse Team:** Dispatch Queue, Pick Plan, Challan, Stock
5. **Logistics Team:** Truck Plan, In-Transit, GRN
6. **Manager:** View-only access to all modules + Reports

### API Authentication:
- JWT tokens with role claims
- Token expiry: 8 hours
- Refresh token: 30 days

---

## 📊 Database Indexes (Critical for Performance)

```sql
-- Sales Orders
CREATE INDEX idx_so_status ON sales_orders(status);
CREATE INDEX idx_so_customer ON sales_orders(customer);
CREATE INDEX idx_so_lines_material ON sales_order_lines(materialId);

-- Stock Lots
CREATE INDEX idx_stock_material_status ON stock_lots(materialId, status, receivedDate);
CREATE INDEX idx_stock_bin ON stock_lots(binLocation);

-- Mill Tracker
CREATE INDEX idx_mill_tracker_status ON mill_tracker(productionStatus, status);
CREATE INDEX idx_mill_tracker_material ON mill_tracker(materialId);

-- In-Transit
CREATE INDEX idx_transit_status ON in_transit_tracking(status);
CREATE INDEX idx_transit_tracking ON in_transit_tracking(trackingNumber);

-- Pick Plans
CREATE INDEX idx_pick_plan_so ON pick_plans(soId, soLineId);
CREATE INDEX idx_pick_plan_status ON pick_plans(status);
```

---

## 🧪 Testing Checklist

### Unit Tests:
- ✅ Coverage Engine calculations
- ✅ FIFO stock allocation logic
- ✅ Weight calculations
- ✅ Status transition validations

### Integration Tests:
- ✅ SO → Coverage → Allocation flow
- ✅ PO → Mill Tracker → Dispatch flow
- ✅ Pick Plan → Challan → Truck Plan → In-Transit flow
- ✅ In-Transit → GRN → Stock Lot flow

### Load Tests:
- ✅ 1000 concurrent API requests
- ✅ 10,000 stock lots query performance
- ✅ Bulk update with 500 records

---

## 📝 Notes

- All date/time fields should be in **ISO 8601 format** with timezone
- All currency amounts in **Rupees (INR)** stored as integers (paise)
- All quantities stored as **integers** (smallest unit = 1 sheet)
- All weights stored as **float** with 2 decimal precision
- Soft delete for all master data (set `isActive = false`)
- Audit trail for all critical operations (created_by, created_at, updated_by, updated_at)

---

**End of Document**
