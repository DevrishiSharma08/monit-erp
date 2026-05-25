// ============================================================================
// MONIT PAPER AGENCY ERP - NEW WORKFLOW DATA MODELS
// ============================================================================

// ============================================================================
// 1. CUSTOMER INQUIRY (Pre-Sales Order)
// ============================================================================

export interface CustomerInquiry {
  id: string;
  inquiryNumber: string;
  customer: string;
  contactPerson: string;
  phone: string;
  email?: string;
  inquiryDate: string;
  source: 'Phone' | 'WhatsApp' | 'Email' | 'Visit';
  requirements: InquiryRequirement[];
  status: 'Draft' | 'Stock Checked' | 'Waiting Mill Confirmation' | 'Mill Confirmed' | 'Customer Confirmed' | 'Converted' | 'Lost' | 'Confirmed' | 'On Hold' | 'Rejected';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  remarks?: string;
  notes?: string;
  expectedConversionDate?: string;
  convertedToSO?: string; // SO number if converted
  /** Set once admin confirms the inquiry */
  linkedSoNumber?: string;
  /** Admin action timestamp */
  adminActionAt?: string;
  salesman: string;
}

export interface InquiryRequirement {
  id: string;
  materialId: string; // Reference to Material Master
  materialCode?: string; // Auto-filled from Material (Mill/Category/GSM/Size/Packing)
  gsm?: number; // Auto-filled
  size?: string; // Auto-filled
  packingType?: string; // Auto-filled
  quantity: number;
  unit: 'KG' | 'Sheet';
  requiredDeliveryDate: string;
  deliveryLocation: string;
  urgency: 'Normal' | 'Urgent' | 'Critical';
  physicalStock?: number; // For coverage calculation
  transitStock?: number; // For coverage calculation
  coveragePercentage?: number; // Calculated
  millConfirmationRequired?: boolean;
  suggestedMill?: string;
  alternatives?: { materialId: string; materialCode: string; availableQty: number }[];
}

// ============================================================================
// 2. SALES ORDER (With Line-Level Allocation)
// ============================================================================

export interface SalesOrderLine {
  id: string;
  lineNumber: number;

  // Material Master reference (replaces free-text paper/gsm/size)
  materialId: string;
  materialCode?: string; // Auto-filled from Material Master
  gsm?: number; // Auto-filled
  size?: string; // Auto-filled
  packingType?: string; // Auto-filled
  unit?: 'KG' | 'Sheet'; // Auto-filled

  orderedQty: number;       // weight in KG (primary for pricing and allocation)
  weightKg?: number;        // explicit weight field (same as orderedQty for new SOs)
  qty?: number;             // informational quantity (sheets/bundles/reels — optional)
  rate: number;             // ₹/KG from Rate Master
  discount?: number;        // ₹/KG discount from Rate Master
  amount: number;

  // Delivery details per line
  deliveryAddress: string;
  requiredDeliveryDate: string;

  // Coverage Check Results (calculated after save)
  physicalStock?: number; // Available physical stock
  transitStock?: number; // Stock in transit
  coveragePercentage?: number; // (physicalStock + transitStock) / orderedQty * 100
  purchaseRequired?: number; // Shortfall qty

  // Allocation Status (set by coverage engine)
  stockAllocated?: number; // qty allocated from stock
  transitAllocated?: number; // qty allocated from transit
  purchaseAllocated?: number; // qty allocated to purchase
  allocationType?: 'Stock' | 'Purchase' | 'Mixed'; // Auto-calculated based on allocation

  // Fulfillment Status
  status: 'Pending Allocation' | 'Allocated' | 'In Progress' | 'Dispatched' | 'Delivered';
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customer: string; // Company name
  contactPerson: string; // Contact person from customer
  salesman: string;
  orderDate: string;
  lines: SalesOrderLine[];
  totalValue: number;

  // New state machine workflow
  status: 'Approval Pending' | 'Draft' | 'Pending Allocation' | 'Partially Allocated' | 'Fully Allocated' | 'In Dispatch' | 'Partially Delivered' | 'Completed' | 'Closed' | 'Cancelled';

  // Dropdown-based fields
  paymentTerms: '30 Days' | '45 Days' | '60 Days' | 'Advance' | 'Against Delivery';
  deliveryTerms: string;
  deliveryMode: 'From Stock' | 'Direct Mill Delivery' | 'Mixed';

  remarks?: string;

  // Inquiry reference (optional, auto-copy lines if exists)
  inquiryRef?: string;

  // Invoice reference (after invoicing)
  invoiceNumber?: string;

  // PO tracking — populated once POs are raised against this SO
  linkedPoIds?: string[];
}

// ============================================================================
// 3. INVENTORY - BIN LOCATIONS & FIFO TRACKING
// ============================================================================

export interface BinLocation {
  id: string;
  warehouse: string; // Lasudia, Sanwer, Pithampur (Godown ID/FK)
  zone: string; // A, B, C, D
  rack: string; // 1, 2, 3...
  rackNo: number; // Rack number (numeric for sorting)
  rowNo: number; // Row number within rack
  bin: string; // A1, A2, B1...
  fullCode: string; // e.g. "Lasudia-A-3-B2"
  capacity: number; // in sheets/reams (Max Capacity)
  occupied: number;
  available: number;
  status: 'Active' | 'Maintenance' | 'Full';
}

export interface StockLot {
  id: string;
  lotNumber: string;
  paper: string;
  materialId?: string;   // link to Material Master
  gsm: number;
  size: string;
  mill: string;

  // Quantity tracking
  receivedQty: number;
  currentQty: number;
  allocatedQty: number; // reserved for SOs
  availableQty: number; // currentQty - allocatedQty

  // FIFO
  receivedDate: string; // for FIFO picking
  grnNumber: string;

  // Location
  binLocation: string; // BinLocation.fullCode
  warehouse: string;

  // Status
  status: 'Available' | 'Allocated' | 'Depleted';
  quality: 'A Grade' | 'B Grade' | 'Damaged';
}

export interface Stock {
  id: string;
  paper: string;
  gsm: number;
  size: string;
  mill: string;

  // Aggregate quantities
  totalQty: number;
  allocatedQty: number;
  availableQty: number;

  // Location summary
  warehouse: string;
  binLocations: string[]; // list of bin codes where this stock is stored

  // Lot tracking
  lots: string[]; // StockLot IDs
  oldestLotDate: string; // for aging analysis

  status: 'Available' | 'Low Stock' | 'Out of Stock';
}

// ============================================================================
// 4. ALLOCATION SYSTEM
// ============================================================================

export interface StockAllocation {
  id: string;
  allocationNumber: string;
  soNumber: string;
  soLineId: string;
  customer: string;

  paper: string;
  gsm: number;
  size: string;
  allocatedQty: number;

  // Stock lot allocations (FIFO)
  lotAllocations: {
    lotNumber: string;
    qty: number;
    binLocation: string;
  }[];

  allocationDate: string;
  status: 'Reserved' | 'Picked' | 'Dispatched' | 'Released'; // Released if SO cancelled
  expiresOn?: string; // allocation expiry
}

export interface PurchaseAllocation {
  id: string;
  allocationNumber: string;
  soNumber: string;
  soLineId: string;
  customer: string;

  paper: string;
  gsm: number;
  size: string;
  requiredQty: number;

  // PO reference (once PO is raised)
  poNumber?: string;
  mill?: string;

  allocationDate: string;
  expectedArrival?: string;
  status: 'Pending PO' | 'PO Raised' | 'In Production' | 'Dispatched' | 'Received';
  deliveryMode?: 'Direct To Customer' | 'To Godown'; // set during truck load planning
}

// ============================================================================
// 5. PICK PLAN (FIFO + Bin Location)
// ============================================================================

export interface PickPlanLine {
  id: string;
  soLineId: string;
  paper: string;
  gsm: number;
  size: string;
  qtyToPick: number;

  // FIFO picking instructions
  lotNumber: string;
  binLocation: string;
  qtyFromThisLot: number;

  pickSequence: number; // FIFO order
  picked: boolean;
  pickedQty?: number;
  pickedBy?: string;
  pickedAt?: string;
}

export interface PickPlan {
  id: string;
  pickPlanNumber: string;
  soNumber: string;
  customer: string;
  warehouse: string;

  lines: PickPlanLine[];

  totalQty: number;
  createdDate: string;
  plannedPickDate: string;
  status: 'Pending' | 'In Progress' | 'Completed';

  assignedTo?: string; // warehouse staff
  completedAt?: string;
}

// ============================================================================
// 6. CHALLAN + LOADING
// ============================================================================

export interface ChallanLine {
  id: string;
  soLineId: string;
  paper: string;
  gsm: number;
  size: string;
  orderedQty: number;
  pickedQty: number;
  quantity: number;

  // Picked lot details
  lotNumber: string;
  binLocation: string;
}

export interface Challan {
  id: string;
  challanNumber: string;
  challanDate: string;
  soNumber: string;
  pickPlanNumber: string;
  truckLoadPlanNumber: string;
  customer: string;
  customerAddress: string;
  deliveryMode: 'Direct To Customer' | 'To Godown';
  warehouse: string;
  expectedDeliveryDate: string;

  lines: ChallanLine[];
  totalQty: number;
  totalWeight: number;

  // Truck & Driver (auto from TLP)
  truckNumber: string;
  driverName: string;
  driverPhone: string;
  transporterName: string;

  // Loading details
  loadingStartTime?: string;
  loadingEndTime?: string;
  loadedBy?: string;
  numberOfBundles?: number;
  weightKg?: number;

  // Logistics fields
  lrNumber?: string;
  eWayBillNumber?: string;
  gateOutTime?: string;
  dispatchTime?: string;
  transportCost?: number;

  status: 'Ready' | 'Loading' | 'Loaded' | 'Dispatched';

  // Invoice reference
  invoiceNumber?: string;
  invoiceEligible?: boolean;

  // Tracking
  inTransitTrackingId?: string;

  remarks?: string;
}

// ============================================================================
// 7. PURCHASE ORDERS - MILL ORDER TRACKER
// ============================================================================

export interface PartialDelivery {
  id: string;
  batchNo: number;
  date: string;
  qty: number;
  truckNumber?: string;
  millInvoiceNo?: string;
  remarks?: string;
}

export interface MillTrackerHistoryLog {
  id: string;
  date: string;
  user: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  oldQty?: number;
  newQty?: number;
  remarks?: string;
}

export interface MillOrderTracker {
  id: string;
  poNumber: string;
  poItemId?: string; // Reference to PurchaseOrderItem
  poDate: string;
  mill: string;
  millAddress?: string;
  millUnitId?: number;
  millUnitName?: string;

  paper: string;
  gsm: number;
  size: string;

  // Quantity tracking
  orderedQty: number;
  readyQty: number;
  dispatchedQty: number;
  balanceQty: number; // Auto-calculated: orderedQty - dispatchedQty

  rate: number;
  totalAmount: number;

  // Mill production status
  productionStatus: 'Order Placed' | 'In Production' | 'Partial Ready' | 'Ready' | 'Dispatched' | 'Delayed' | 'Cancelled';
  productionProgress: number; // Auto-calculated: (readyQty / orderedQty) * 100

  // Dates
  expectedDelivery: string;
  actualDispatchDate?: string;
  lastUpdate: string;
  lastUpdatedBy?: string;

  // Delay tracking (auto-calculated)
  delayDays?: number; // Today - expectedDeliveryDate (if not Ready/Dispatched)

  // Linked SO (if direct purchase for SO)
  soNumber?: string;

  // Delivery mode
  deliveryMode?: 'Direct To Customer' | 'To Godown';

  // Mill invoice
  millInvoiceNo?: string;

  // History log
  history?: MillTrackerHistoryLog[];

  remarks?: string;

  // Customer linkage (denormalized from linked SO for display)
  customerName?: string;        // PO delivery customer
  soCustomerName?: string;      // Original SO customer (may differ in blind/override shipments)
  customerId?: string;

  // Mill's own SO reference number
  millSONumber?: string;

  // Required delivery date from linked SO
  soDeliveryDate?: string;

  // Direct delivery address from PO
  directDeliveryAddress?: string;

  // Partial delivery batches (mill may dispatch in multiple lots)
  partialDeliveries?: PartialDelivery[];
}

export interface PurchaseOrderItem {
  id: string;
  itemNumber: number;

  // Material specification
  materialId: string;
  materialCode?: string; // Auto-filled from Material Master
  categoryName?: string; // Auto-filled
  gsm: number;
  size: string;
  packingType?: string;

  // Quantities
  orderedQty: number;
  stockQty?: number;    // For Mixed type: qty going to stock
  readyQty?: number;
  dispatchedQty?: number;
  pendingQty?: number;

  // Pricing
  rate: number;
  amount: number;

  // SO Linking (for coverage tracking)
  soNumber?: string;
  soLineId?: string;
  allocationType?: 'Against SO' | 'For Stock';

  // Delivery (for direct delivery items)
  deliveryLocation?: string;
  deliveryAddress?: string;

  // Weight (carried from SO line)
  weightKg?: number;

  // Item-level note
  remark?: string;

  // Status
  status: 'Pending' | 'In Production' | 'Partial Ready' | 'Ready' | 'Dispatched' | 'Received';
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;

  // Header information
  mill: string;
  millId?: string;
  orderDate: string;

  // PO Type
  poType: 'Against Sales Order' | 'For Stock' | 'Mixed';
  linkedSONumber?: string;   // If against SO
  linkedSOId?: string;       // Internal SO id for context linking

  // Delivery
  deliveryMode?: 'Direct To Customer' | 'To Godown';
  directCustomer?: string; // If direct delivery
  directCustomerId?: string;
  directDeliveryAddress?: string;

  // Shipment mode
  // Normal        → mill knows customer, delivers to customer, invoices in customer's name
  // Blind         → mill sees Monit only, delivers to Monit godown, invoice swap en route
  // InvoiceOverride → delivers to SO customer's address, but mill invoices in a different party's name
  shipmentMode?: 'Normal' | 'Blind' | 'InvoiceOverride';
  blindShipment?: boolean;            // legacy alias for shipmentMode === 'Blind'
  invoiceParty?: string;              // InvoiceOverride: company name on mill's invoice
  invoicePartyId?: string;

  // Mill SO No. — assigned by mill, used for tracking (optional: some mills don't provide)
  millSONumber?: string;

  // Dates
  expectedDispatchDate?: string;
  expectedDeliveryDate: string;

  // Terms
  paymentTerms: string;
  freightType?: 'To Pay' | 'Included';

  // Items
  items: PurchaseOrderItem[];

  // Totals (auto-calculated)
  totalQuantity: number;
  totalValue: number;

  // Status
  status: 'Draft' | 'Sent to Mill' | 'Acknowledged' | 'In Production' | 'Partial Ready' | 'Ready' | 'Dispatched' | 'Part Received' | 'Completed';

  // Tally Integration (hidden fields)
  tallyLedgerName?: string;
  purchaseLedgerGroup?: string;
  gstPercentage?: number;

  remarks?: string;
  specialInstructions?: string;

  // Mill tracker reference
  trackerRef?: string;
}

// ============================================================================
// 8. TRUCK LOAD PLAN & LOGISTICS
// ============================================================================

// One row per PO-item inside a truck load plan
export interface TruckLoadPlanItem {
  id: string;

  // Source tracking
  trackerSourceId?: string; // MillOrderTracker.id
  poNumber: string;
  poItemId?: string;
  soNumber?: string;
  soLineId?: string;

  // Material
  paper: string;
  gsm: number;
  size: string;

  // Quantity
  quantity: number;
  weightKg?: number; // pre-calculated; falls back to calcWeightKg() on display

  // LIFO load position: 1 = loaded first on truck = last delivery stop
  loadOrder: number;

  // Delivery (can differ per item — multi-stop support)
  customerName?: string;
  deliveryLocation?: string;
  deliveryAddress?: string;

  // Documents
  millInvoiceNo?: string;
  deliveryBillNo?: string;
}

export interface TruckLoadPlan {
  id: string;
  planNumber: string;
  planDate: string;

  // Truck details
  truckNumber?: string;
  truckType?: string;
  driverName?: string;
  driverPhone?: string;
  transporterName?: string;
  truckCapacityKg?: number;
  freightAmount?: number;

  // Route
  origin: string; // Mill name OR Godown name
  deliveryMode: 'Direct To Customer' | 'To Godown' | 'Multi-Stop';

  // Dates
  plannedLoadDate: string;
  plannedDeliveryDate: string;
  actualLoadDate?: string;
  actualDeliveryDate?: string;

  // Items — one per PO item; multiple POs can share a truck
  items: TruckLoadPlanItem[];

  status: 'Planned' | 'Loading' | 'Dispatched' | 'Received';

  // Reference
  inTransitTrackerId?: string;
}

// ============================================================================
// 9. IN-TRANSIT TRACKING
// ============================================================================

export interface InTransitTracking {
  id: string;
  trackingNumber: string;

  // Load reference
  loadPlanId: string;
  poNumber?: string;
  soNumber?: string;
  challanNumber?: string;

  // Shipment details
  truckNumber: string;
  driverName: string;
  driverPhone: string;

  origin: string;
  destination: string;
  deliveryMode: 'Direct To Customer' | 'To Godown';

  // Tracking
  dispatchedDate: string;
  expectedArrival: string;
  currentLocation?: string;
  lastUpdate?: string;

  status: 'Dispatched' | 'Reached Destination' | 'Unloading' | 'Received';

  // Location updates
  locationUpdates: {
    timestamp: string;
    location: string;
    remarks: string;
  }[];

  // Delivery
  deliveredDate?: string;
  receivedBy?: string;

  // Documents
  lrNumber?: string;
  eWayBillNumber?: string;
}

// ============================================================================
// 10. PURCHASE INVOICE (Mill → Monit)
// ============================================================================

export interface PurchaseInvoice {
  id: string;
  purchaseInvoiceNumber: string; // Mill's invoice number
  invoiceDate: string;

  mill: string;
  poNumber: string;

  paper: string;
  gsm: number;
  size: string;
  quantity: number;

  // Amounts
  baseAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;

  // Delivery mode
  deliveryMode: 'Direct To Customer' | 'To Godown';

  // If direct to customer
  directCustomer?: string;
  customerSO?: string;

  // If to godown
  grnNumber?: string; // GRN created after receipt

  // Status
  status: 'Punched' | 'Dispatched' | 'Received' | 'GRN Done';

  // Payment
  paymentStatus: 'Pending' | 'Partially Paid' | 'Paid';
  paymentDueDate: string;
  paidAmount?: number;

  remarks?: string;
}

// ============================================================================
// 11. GRN (Only for "To Godown" deliveries)
// ============================================================================

export interface GRN {
  id: string;
  grnNumber: string;
  grnDate: string;

  // PO Reference
  poNumber: string;
  poId?: string;         // link to PurchaseOrder.id
  purchaseInvoiceNumber: string;
  millChallanNumber?: string;
  mill: string;

  // Material
  paper: string;
  materialId?: string;   // link to Material Master
  gsm: number;
  size: string;

  // Quantity Tracking (PO vs Received)
  orderedQty: number;
  previouslyReceivedQty: number;
  receivedQty: number; // This GRN
  shortQty: number;
  damagedQty: number;
  balanceQty: number;

  // Weight Tracking (future-ready)
  receivedWeightMT?: number;
  expectedWeightMT?: number;

  // Location
  warehouse: string;
  binLocation: string;
  suggestedBin?: string;

  // Quality Check
  condition: 'Good' | 'Slight Damage' | 'Wet' | 'Torn' | 'Mixed GSM';
  qcResult: 'Accepted' | 'Accepted with Remark' | 'Rejected' | 'Hold';
  qualityGrade: 'A Grade' | 'B Grade' | 'Rejected';

  // Stock lot created
  lotNumber: string; // Auto: Mill-Paper-GSM-Size-Date-Seq

  // Transport & Logistics
  lrNumber: string;
  transporterName: string;
  vehicleNumber?: string;
  receivedBy?: string;
  unloadingStartTime?: string;
  unloadingEndTime?: string;

  // Status Workflow
  status: 'Draft' | 'QC Pending' | 'Approved' | 'Stock Updated' | 'Discrepancy Raised';
  verifiedBy?: string;
  verifiedDate?: string;
  qcApprovedBy?: string;

  // Mill Tracker linkage
  millTrackerUpdated?: boolean;

  // Truck Load Plan linkage (set when GRN is created from a dispatched TLP)
  sourceLoadPlanNumber?: string;

  remarks?: string;
}

// ============================================================================
// 12. SALES INVOICE (Monit → Customer)
// ============================================================================

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;

  // References
  soNumber: string;
  challanNumber?: string; // if dispatched from godown

  // Customer
  customer: string;
  customerCompany: string;
  customerGST: string;
  deliveryAddress: string;

  // Items
  lines: {
    id: string;
    paper: string;
    gsm: number;
    size: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];

  // Amounts
  baseAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;

  // Status
  status: 'Draft' | 'Issued' | 'Sent to Tally' | 'Paid';

  // Payment
  paymentStatus: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue';
  paymentDueDate: string;
  paidAmount?: number;

  // Tally sync
  tallySync: boolean;
  tallySyncDate?: string;
  tallyVoucherNumber?: string;

  remarks?: string;
}

// ============================================================================
// 13. TALLY EXPORT
// ============================================================================

export interface TallyExport {
  id: string;
  exportNumber: string;
  exportDate: string;
  exportType: 'Sales Invoice' | 'Purchase Invoice' | 'Payment Receipt' | 'Payment Made';

  // Invoice references
  invoiceNumbers: string[]; // batch export

  // Export file
  fileName: string;
  fileFormat: 'XML' | 'Excel' | 'CSV';
  exportedBy: string;

  status: 'Generated' | 'Sent to Tally' | 'Synced' | 'Error';

  // Sync details
  syncedAt?: string;
  errorMessage?: string;

  recordCount: number;
}

// ============================================================================
// 14. MASTER DATA (Existing + Updates)
// ============================================================================

export interface CustomerContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  designation?: string;
}

export interface CustomerDeliveryLocation {
  id: string;
  unitAddress: string;
  phone: string;
}

export interface Customer {
  id: string;
  customerCode?: string;     // e.g. CUST-001
  company: string; // Customer Company Name
  name: string; // Contact person name (can have multiple from same company)
  tallyLedgerName: string; // Exact Tally Ledger Name (important for Sales Voucher mapping)
  tallyLedgerNo?: string;   // alias for new master page

  // Tax details
  gst: string; // GSTIN
  gstNo?: string;            // alias for new master page
  pan: string; // PAN number
  state: string; // State for GST

  // Contact details
  phone?: string;
  email?: string;
  emails?: string[];         // Multiple emails for SO confirmation
  officeAddress?: string;

  // Credit terms
  creditLimit: number;
  creditDays: number; // Credit payment days
  outstanding: number;

  // Assignment & Status
  salesman: string; // Assigned Salesman
  status: 'Active' | 'Inactive' | 'Blocked';

  // Multiple addresses support
  consignees: Consignee[];
  deliveryAddresses: DeliveryAddress[];

  // New structured contacts and delivery locations
  contacts?: CustomerContact[];
  deliveryLocations?: CustomerDeliveryLocation[];
}

export interface Consignee {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  gst?: string;
}

export interface DeliveryAddress {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPerson: string;
  phone: string;
  isDefault: boolean;
}

// ============================================================================
// CATEGORY MASTER (for Material categorization)
// ============================================================================

export interface Category {
  id: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export const mockCategories: Category[] = [
  { id: '1', name: 'Grey Back', description: 'Duplex board with grey back', status: 'Active' },
  { id: '2', name: 'White Back', description: 'Duplex board with white back', status: 'Active' },
  { id: '3', name: 'FBB', description: 'Folding Box Board', status: 'Active' },
];

// ── Stock Group (Quality) Master ──────────────────────────────────────────────

export interface StockGroup {
  id: string;
  name: string;
  description?: string;
  gsmRanges: string; // comma-separated or range, e.g. "200, 250, 300" or "200-400"
  status: 'Active' | 'Inactive';
}

export const mockStockGroups: StockGroup[] = [
  { id: 'sg1', name: 'Grey Back',  description: 'Duplex board – grey back',  gsmRanges: '200, 250, 300, 350, 400', status: 'Active'   },
  { id: 'sg2', name: 'White Back', description: 'Duplex board – white back', gsmRanges: '200, 250, 300',           status: 'Active'   },
  { id: 'sg3', name: 'FBB',        description: 'Folding Box Board',         gsmRanges: '200-400',                 status: 'Active'   },
  { id: 'sg4', name: 'Kraft',      description: 'Kraft / brown paper',       gsmRanges: '70-120',                  status: 'Active'   },
  { id: 'sg5', name: 'Art Paper',  description: 'Coated art paper',          gsmRanges: '90, 130, 170',            status: 'Inactive' },
];

// ── Stock Category (GSM) Master ───────────────────────────────────────────────

export interface StockCategory {
  id: string;
  gsmType: 'single' | 'range';
  gsm?: number;    // for single
  gsmMin?: number; // for range
  gsmMax?: number; // for range
  label: string;   // auto display, e.g. "200 GSM" or "200-300 GSM"
  status: 'Active' | 'Inactive';
}

export const mockStockCategories: StockCategory[] = [
  { id: 'sc1', gsmType: 'single', gsm: 200, label: '200 GSM', status: 'Active' },
  { id: 'sc2', gsmType: 'single', gsm: 220, label: '220 GSM', status: 'Active' },
  { id: 'sc3', gsmType: 'single', gsm: 250, label: '250 GSM', status: 'Active' },
  { id: 'sc4', gsmType: 'single', gsm: 270, label: '270 GSM', status: 'Active' },
  { id: 'sc5', gsmType: 'single', gsm: 300, label: '300 GSM', status: 'Active' },
  { id: 'sc6', gsmType: 'single', gsm: 350, label: '350 GSM', status: 'Active' },
  { id: 'sc7', gsmType: 'single', gsm: 400, label: '400 GSM', status: 'Active' },
  { id: 'sc8', gsmType: 'range',  gsmMin: 200, gsmMax: 400, label: '200-400 GSM', status: 'Active' },
];

// ── Item Type Master ──────────────────────────────────────────────────────────

export interface ItemType {
  id: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export const mockItemTypes: ItemType[] = [
  { id: 'it1', name: 'Sheet', description: 'Cut sheets in packs',  status: 'Active' },
  { id: 'it2', name: 'Reel',  description: 'Paper rolls / reels',  status: 'Active' },
];

// ============================================================================
// MATERIAL MASTER (Tally-compatible format: Mill/Category/GSM/Size/Packing)
// ============================================================================

export interface Material {
  id: string;
  // Mill reference
  millId: string;
  millName?: string; // populated for display

  // Category reference
  categoryId: string;
  categoryName?: string; // populated for display

  // Material specifications
  gsm: number;
  size: string; // display format like "22x36"
  length: number; // in inches
  width: number; // in inches

  // Packing & Unit
  packingType: 'Sheet' | 'Reel';
  sheetsPerPack?: number;       // legacy alias for sheetsPerPacket
  sheetsPerPacket?: number;     // sheets in 1 packet
  packetsPerBundle?: number;    // packets in 1 bundle
  sheetsPerBox?: number;        // sheets in 1 box
  unitType: 'KG' | 'Sheet';
  conversionFactor: number; // KG per sheet (or per reel)

  // Legacy/computed fields
  paperType: string; // Computed as Mill/Category/GSM/Size/Packing
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface MillContact {
  name: string;
  phone: string;
  email: string;
}

export interface MillUnit {
  id: string;
  unitName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Mill {
  id: string;
  name: string;
  shortCode: string;
  tallyLedgerName: string;

  // Legacy single-contact fields (keep for backward compat)
  contactPerson: string;
  phone: string;
  email: string;
  gst: string;
  location: string;
  region: string;
  leadTimeDays: number;
  creditDays: number;
  defaultFreightType: 'To Pay' | 'Paid' | 'Included';
  specialization: string[];
  paymentTerms: string;

  // New extended fields (optional for backward compat)
  millCode?: string;
  contacts?: MillContact[];
  emails?: string[];
  gstNo?: string;
  tallyLedgerNo?: string;
  units?: MillUnit[];

  status: 'Active' | 'Inactive';
}

export interface Salesman {
  id: string;
  name: string;
  phone: string; // Mobile
  email: string;
  territory: string; // Area
  monthlyTarget: number; // Monthly target in rupees
  status: 'Active' | 'Inactive';
}

export interface Location {
  id: string;
  name: string; // Godown Name
  type: 'Warehouse' | 'Mill' | 'Customer Site';
  address: string;
  city: string;
  state: string;
  pincode: string;
  capacity?: number;
  isMainGodown: boolean; // Is this a main godown? (for Tally hierarchy)
  status: 'Active' | 'Inactive';
}

// ── Warehouse Master (redesigned) ────────────────────────────────────────────
export interface WarehouseBin {
  id: string;
  binNo: string;
  binName: string;
  capacityType: 'KG' | 'Sheet';
  capacity: number;
}

export interface Warehouse {
  id: string;
  unitName: string;      // Monit's godown unit/location name
  warehouseName: string;
  isMain: boolean;
  warehouseNo: string;
  bins: WarehouseBin[];
  status: 'Active' | 'Inactive';
}

export const mockWarehouses: Warehouse[] = [
  {
    id: 'wh1',
    unitName: 'Monit Indore Main',
    warehouseName: 'Main Godown',
    isMain: true,
    warehouseNo: 'WH-001',
    bins: [
      { id: 'b1', binNo: 'B-01', binName: 'Ground Floor A', capacityType: 'Sheet', capacity: 5000 },
      { id: 'b2', binNo: 'B-02', binName: 'Ground Floor B', capacityType: 'Sheet', capacity: 5000 },
      { id: 'b3', binNo: 'B-03', binName: 'First Floor',    capacityType: 'KG',    capacity: 10000 },
    ],
    status: 'Active',
  },
  {
    id: 'wh2',
    unitName: 'Monit Pithampur',
    warehouseName: 'Pithampur Warehouse',
    isMain: false,
    warehouseNo: 'WH-002',
    bins: [
      { id: 'b4', binNo: 'B-01', binName: 'Section A', capacityType: 'Sheet', capacity: 3000 },
      { id: 'b5', binNo: 'B-02', binName: 'Section B', capacityType: 'Sheet', capacity: 3000 },
    ],
    status: 'Active',
  },
  {
    id: 'wh3',
    unitName: 'Monit Dewas',
    warehouseName: 'Dewas Storage',
    isMain: false,
    warehouseNo: 'WH-003',
    bins: [
      { id: 'b6', binNo: 'B-01', binName: 'Row A', capacityType: 'KG', capacity: 8000 },
    ],
    status: 'Active',
  },
];

export interface PaperSize {
  id: string;
  name: string;
  width: number;
  height: number;
  description?: string;
  category: 'Standard' | 'Custom' | 'Reel';
  status: 'Active' | 'Inactive';
}

// ============================================================================
// 15. PAYMENTS (Existing - Keep for Reference)
// ============================================================================

export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  customer: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: string;
  paymentMode: 'NEFT' | 'RTGS' | 'Cheque' | 'PDC' | 'Cash' | 'UPI';
  bankName: string;
  reference: string;
  status: 'Received' | 'Cleared' | 'Bounced' | 'Pending';
}

export interface MillPayment {
  id: string;
  paymentNumber: string;
  mill: string;
  grnNumber: string;
  millInvoiceNumber: string;
  amount: number;
  paymentDate: string;
  paymentMode: 'NEFT' | 'RTGS' | 'Cheque' | 'PDC';
  bankName: string;
  reference: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

// ============================================================================
// MOCK DATA - Minimal set for testing
// ============================================================================

export const mockCustomers: Customer[] = [
  {
    id: '1',
    company: 'Raj Printers Pvt Ltd',
    name: 'Raj Kumar',
    tallyLedgerName: 'Raj Printers Pvt Ltd - Indore',
    gst: '23AABCR1234F1Z5',
    pan: 'AABCR1234F',
    state: 'Madhya Pradesh',
    phone: '+91-9876543210',
    email: 'raj@rajprinters.com',
    creditLimit: 1000000,
    creditDays: 45,
    outstanding: 250000,
    salesman: 'Ramesh Kumar',
    status: 'Active',
    consignees: [],
    deliveryAddresses: [
      { id: 'da1', label: 'Main Office', address: '123 Industrial Area', city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', contactPerson: 'Raj Kumar', phone: '+91-9876543210', isDefault: true },
      { id: 'da1b', label: 'Warehouse', address: '45 Scheme No. 54', city: 'Indore', state: 'Madhya Pradesh', pincode: '452010', contactPerson: 'Raj Kumar', phone: '+91-9876543210', isDefault: false },
    ],
    contacts: [
      { id: 'cc1', name: 'Raj Kumar', phone: '+91-9876543210', email: 'raj@rajprinters.com', designation: 'Director' },
      { id: 'cc2', name: 'Neha Kumar', phone: '+91-9876543215', email: 'neha@rajprinters.com', designation: 'Purchase Manager' },
      { id: 'cc3', name: 'Mohan Lal', phone: '+91-9876543219', email: 'mohan@rajprinters.com', designation: 'Accounts' },
    ],
  },
  {
    id: '2',
    company: 'Raj Printers Pvt Ltd',
    name: 'Sunil Kumar',
    tallyLedgerName: 'Raj Printers Pvt Ltd - Indore',
    gst: '23AABCR1234F1Z5',
    pan: 'AABCR1234F',
    state: 'Madhya Pradesh',
    phone: '+91-9876543211',
    email: 'sunil@rajprinters.com',
    creditLimit: 1000000,
    creditDays: 45,
    outstanding: 250000,
    salesman: 'Ramesh Kumar',
    status: 'Active',
    consignees: [],
    deliveryAddresses: [
      { id: 'da2', label: 'Branch Office', address: '456 MG Road', city: 'Indore', state: 'Madhya Pradesh', pincode: '452002', contactPerson: 'Sunil Kumar', phone: '+91-9876543211', isDefault: false }
    ]
  },
  {
    id: '3',
    company: 'Gupta Packaging Ltd',
    name: 'Anil Gupta',
    tallyLedgerName: 'Gupta Packaging Ltd - Pithampur',
    gst: '23AABCG5678K1Z6',
    pan: 'AABCG5678K',
    state: 'Madhya Pradesh',
    phone: '+91-9876543220',
    email: 'anil@guptapkg.com',
    creditLimit: 1500000,
    creditDays: 30,
    outstanding: 450000,
    salesman: 'Suresh Patel',
    status: 'Active',
    consignees: [],
    deliveryAddresses: [
      { id: 'da3', label: 'Factory', address: 'Plot 101, Industrial Area', city: 'Pithampur', state: 'Madhya Pradesh', pincode: '454775', contactPerson: 'Anil Gupta', phone: '+91-9876543220', isDefault: true },
      { id: 'da3b', label: 'Indore Office', address: '12 Navlakha', city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', contactPerson: 'Priya Gupta', phone: '+91-9876543225', isDefault: false },
    ],
    contacts: [
      { id: 'cc4', name: 'Anil Gupta', phone: '+91-9876543220', email: 'anil@guptapkg.com', designation: 'Owner' },
      { id: 'cc5', name: 'Priya Gupta', phone: '+91-9876543225', email: 'priya@guptapkg.com', designation: 'Accounts' },
    ],
  },
  {
    id: '4',
    company: 'Indus',
    name: 'Devesh Sharma',
    tallyLedgerName: 'Indus - Indore',
    gst: '23AABCI9012M1Z3',
    pan: 'AABCI9012M',
    state: 'Madhya Pradesh',
    phone: '+91-9876543230',
    email: 'devesh@indus.com',
    creditLimit: 800000,
    creditDays: 30,
    outstanding: 120000,
    salesman: 'Current User',
    status: 'Active',
    consignees: [],
    deliveryAddresses: [
      { id: 'da4', label: 'Office', address: '22 Vijay Nagar', city: 'Indore', state: 'Madhya Pradesh', pincode: '452010', contactPerson: 'Devesh Sharma', phone: '+91-9876543230', isDefault: true },
    ],
    contacts: [
      { id: 'cc6', name: 'Devesh Sharma', phone: '+91-9876543230', email: 'devesh@indus.com', designation: 'CEO' },
      { id: 'cc7', name: 'Pooja Sharma', phone: '+91-9876543231', email: 'pooja@indus.com', designation: 'Purchase Head' },
    ],
  },
  {
    id: '5',
    company: 'Sharma Paper Works',
    name: 'Rajesh Sharma',
    tallyLedgerName: 'Sharma Paper Works - Indore',
    gst: '23AABCS3456N1Z7',
    pan: 'AABCS3456N',
    state: 'Madhya Pradesh',
    phone: '+91-9876543240',
    email: 'rajesh@sharmapapers.com',
    creditLimit: 600000,
    creditDays: 45,
    outstanding: 80000,
    salesman: 'Ramesh Kumar',
    status: 'Active',
    consignees: [],
    deliveryAddresses: [
      { id: 'da5', label: 'Godown', address: 'Plot 55, Sanwer Road', city: 'Indore', state: 'Madhya Pradesh', pincode: '452015', contactPerson: 'Rajesh Sharma', phone: '+91-9876543240', isDefault: true }
    ]
  },
  {
    id: '6',
    company: 'Mehta Trading Co',
    name: 'Suresh Mehta',
    tallyLedgerName: 'Mehta Trading Co - Indore',
    gst: '23AABCM7890P1Z2',
    pan: 'AABCM7890P',
    state: 'Madhya Pradesh',
    phone: '+91-9876543250',
    email: 'suresh@mehtatrading.com',
    creditLimit: 1200000,
    creditDays: 60,
    outstanding: 300000,
    salesman: 'Suresh Patel',
    status: 'Active',
    consignees: [],
    deliveryAddresses: [
      { id: 'da6', label: 'Warehouse', address: 'Sector 2, Industrial Area', city: 'Pithampur', state: 'Madhya Pradesh', pincode: '454775', contactPerson: 'Suresh Mehta', phone: '+91-9876543250', isDefault: true }
    ]
  },
];

export const mockMills: Mill[] = [
  {
    id: '1',
    name: 'ITC Paperboards',
    shortCode: 'ITC',
    tallyLedgerName: 'ITC Paperboards & Specialty Papers Div',
    contactPerson: 'Suresh Reddy',
    phone: '+91-8765432109',
    email: 'orders@itcpaper.com',
    gst: '36AABCI1234K1Z9',
    location: 'Bhadrachalam, Telangana - 507118',
    region: 'Telangana',
    leadTimeDays: 15,
    creditDays: 30,
    defaultFreightType: 'To Pay',
    specialization: ['FBB', 'SBS'],
    paymentTerms: '30 Days from delivery',
    status: 'Active',
  },
  {
    id: '2',
    name: 'JK Paper',
    shortCode: 'JKP',
    tallyLedgerName: 'JK Paper Ltd',
    contactPerson: 'Anil Sharma',
    phone: '+91-8765432110',
    email: 'sales@jkpaper.com',
    gst: '24AABCJ1234L1Z8',
    location: 'Rayagada, Odisha - 765017',
    region: 'Odisha',
    leadTimeDays: 20,
    creditDays: 45,
    defaultFreightType: 'Paid',
    specialization: ['White Back', 'Grey Back'],
    paymentTerms: '45 Days from delivery',
    status: 'Active',
  },
  {
    id: '3',
    name: 'Seshasayee Paper',
    shortCode: 'SPL',
    tallyLedgerName: 'Seshasayee Paper and Boards Ltd',
    contactPerson: 'Kumar Raja',
    phone: '+91-8765432111',
    email: 'orders@spl.com',
    gst: '33AABCS1234M1Z7',
    location: 'Erode, Tamil Nadu - 638004',
    region: 'Tamil Nadu',
    leadTimeDays: 12,
    creditDays: 30,
    defaultFreightType: 'Included',
    specialization: ['FBB', 'White Back'],
    paymentTerms: '30 Days from delivery',
    status: 'Active',
  },
];

export const mockSalesmen: Salesman[] = [
  { id: '1', name: 'Ramesh Kumar', phone: '+91-9876501234', email: 'ramesh@monitpaper.com', territory: 'Indore City', monthlyTarget: 5000000, status: 'Active' },
  { id: '2', name: 'Suresh Patel', phone: '+91-9876501235', email: 'suresh@monitpaper.com', territory: 'Pithampur Industrial Area', monthlyTarget: 4000000, status: 'Active' },
  { id: '3', name: 'Amit Sharma', phone: '+91-9876501236', email: 'amit@monitpaper.com', territory: 'Dewas & Ujjain', monthlyTarget: 3500000, status: 'Active' },
];

export const mockLocations: Location[] = [
  { id: '1', name: 'Lasudia Godown', type: 'Warehouse', address: 'Plot 45, Industrial Area, Lasudia', city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', capacity: 100000, isMainGodown: true, status: 'Active' },
  { id: '2', name: 'Sanwer Godown', type: 'Warehouse', address: 'Plot 12, MIDC Area, Sanwer', city: 'Sanwer', state: 'Madhya Pradesh', pincode: '452020', capacity: 75000, isMainGodown: true, status: 'Active' },
  { id: '3', name: 'Pithampur Godown', type: 'Warehouse', address: 'Sector 3, Industrial Area, Pithampur', city: 'Pithampur', state: 'Madhya Pradesh', pincode: '454775', capacity: 120000, isMainGodown: true, status: 'Active' },
];

export const mockSizes: PaperSize[] = [
  { id: '1', name: '23x36', width: 23, height: 36, description: 'Standard FBB size', category: 'Standard', status: 'Active' },
];

export const mockMaterials: Material[] = [
  {
    id: '1',
    millId: '1',
    millName: 'ITC Paperboards',
    categoryId: '3',
    categoryName: 'FBB',
    gsm: 300,
    size: '23x36',
    length: 23,
    width: 36,
    packingType: 'Sheet',
    sheetsPerPacket: 100,
    packetsPerBundle: 5,
    sheetsPerBox: 500,
    unitType: 'KG',
    conversionFactor: 0.45,
    paperType: 'ITC Paperboards/FBB/300/23x36/Sheet',
    description: 'Premium quality folding box board',
    status: 'Active',
  },
  {
    id: '2',
    millId: '1',
    millName: 'ITC Paperboards',
    categoryId: '2',
    categoryName: 'White Back',
    gsm: 250,
    size: '22x36',
    length: 22,
    width: 36,
    packingType: 'Sheet',
    sheetsPerPacket: 100,
    packetsPerBundle: 5,
    sheetsPerBox: 500,
    unitType: 'KG',
    conversionFactor: 0.38,
    paperType: 'ITC Paperboards/White Back/250/22x36/Sheet',
    description: 'White back duplex board',
    status: 'Active',
  },
  {
    id: '3',
    millId: '1',
    millName: 'ITC Paperboards',
    categoryId: '1',
    categoryName: 'Grey Back',
    gsm: 200,
    size: '24x36',
    length: 24,
    width: 36,
    packingType: 'Sheet',
    sheetsPerPacket: 100,
    packetsPerBundle: 10,
    sheetsPerBox: 1000,
    unitType: 'Sheet',
    conversionFactor: 0.30,
    paperType: 'ITC Paperboards/Grey Back/200/24x36/Sheet',
    description: 'Grey back duplex board',
    status: 'Active',
  },
  {
    id: '4',
    millId: '1',
    millName: 'ITC Paperboards',
    categoryId: '3',
    categoryName: 'FBB',
    gsm: 350,
    size: '25x38',
    length: 25,
    width: 38,
    packingType: 'Reel',
    unitType: 'KG',
    conversionFactor: 0.52,
    paperType: 'ITC Paperboards/FBB/350/25x38/Reel',
    description: 'High GSM FBB in reel form',
    status: 'Active',
  },
];

// ============================================================================
// TRANSPORTER MASTER
// ============================================================================

export interface TransporterVehicle {
  id: string;
  vehicleType: string;   // e.g. "10 Ton Truck"
  capacity: string;      // e.g. "10 MT"
  numberPlate: string;
  driverName: string;
  driverPhone: string;
}

export interface Transporter {
  id: string;
  name: string; // Transporter Name
  tallyLedgerName?: string; // Tally Ledger Name (if freight payable through Tally)
  contactPerson: string;
  phone: string; // Contact
  email?: string;
  address?: string;
  areaCovered: string; // legacy single string
  areaCoveredList?: string[]; // new: multiple towns/cities
  ratePerMT: number; // Rate per MT
  vehicleTypes: string; // legacy
  numberPlate?: string; // legacy
  vehicles?: TransporterVehicle[]; // new: structured vehicle list
  serviceRating: 1 | 2 | 3 | 4 | 5;
  status: 'Active' | 'Inactive';
  remarks?: string;
}

export const mockTransporters: Transporter[] = [
  {
    id: '1',
    name: 'Shree Balaji Transport',
    tallyLedgerName: 'Shree Balaji Transport Services',
    contactPerson: 'Suresh Balaji',
    phone: '+91-9876510001',
    email: 'balaji.transport@gmail.com',
    areaCovered: 'Indore, Pithampur, Dewas',
    ratePerMT: 1800,
    vehicleTypes: '10 Ton, 14 Ton, 18 Ton',
    serviceRating: 5,
    status: 'Active'
  },
  {
    id: '2',
    name: 'Rathi Roadways',
    tallyLedgerName: 'Rathi Roadways Pvt Ltd',
    contactPerson: 'Mahesh Rathi',
    phone: '+91-9876510002',
    email: 'rathi.roads@gmail.com',
    areaCovered: 'Indore, Ujjain, Dewas, Bhopal',
    ratePerMT: 1650,
    vehicleTypes: '10 Ton, 14 Ton',
    serviceRating: 4,
    status: 'Active'
  },
  {
    id: '3',
    name: 'Naveen Transport',
    contactPerson: 'Naveen Singh',
    phone: '+91-9876510003',
    areaCovered: 'Indore, Sanwer, Badnawar',
    ratePerMT: 1500,
    vehicleTypes: '7 Ton, 10 Ton',
    serviceRating: 4,
    status: 'Active'
  },
  {
    id: '4',
    name: 'Sharma Logistics',
    tallyLedgerName: 'Sharma Logistics & Warehousing',
    contactPerson: 'Dinesh Sharma',
    phone: '+91-9876510004',
    email: 'sharma.logistics@gmail.com',
    areaCovered: 'MP, Maharashtra, Gujarat',
    ratePerMT: 2200,
    vehicleTypes: '18 Ton, 22 Ton',
    serviceRating: 3,
    status: 'Active',
    remarks: 'Long-distance specialist'
  },
  {
    id: '5',
    name: 'Patel Cargo',
    contactPerson: 'Rajesh Patel',
    phone: '+91-9876510005',
    areaCovered: 'Indore only',
    ratePerMT: 1200,
    vehicleTypes: '5 Ton, 7 Ton',
    serviceRating: 3,
    status: 'Inactive',
    remarks: 'Currently not available'
  }
];

// Empty arrays for new modules - will be populated as we build
export const mockInquiries: CustomerInquiry[] = [
  {
    id: '1',
    inquiryNumber: 'INQ-2024-001',
    customer: 'Raj Printers Pvt Ltd',
    contactPerson: 'Raj Kumar',
    phone: '+91-9876543210',
    email: 'raj@rajprinters.com',
    inquiryDate: '2024-01-15',
    source: 'Phone',
    requirements: [
      { id: 'r1', materialId: '1', materialCode: 'ITC/FBB/300/23x36/Sheet', gsm: 300, size: '23x36', packingType: 'Sheet', quantity: 10000, unit: 'Sheet', requiredDeliveryDate: '2024-01-25', deliveryLocation: 'Indore Warehouse', urgency: 'Normal', physicalStock: 8000, transitStock: 5000, coveragePercentage: 130, millConfirmationRequired: false },
      { id: 'r2', materialId: '2', materialCode: 'ITC/White Back/250/22x36/Sheet', gsm: 250, size: '22x36', packingType: 'Sheet', quantity: 5000, unit: 'Sheet', requiredDeliveryDate: '2024-01-22', deliveryLocation: 'Indore Warehouse', urgency: 'Urgent', physicalStock: 2000, transitStock: 0, coveragePercentage: 40, millConfirmationRequired: true, suggestedMill: 'ITC Paperboards' }
    ],
    status: 'Stock Checked',
    priority: 'High',
    notes: 'Customer is regular buyer, priority delivery',
    salesman: 'Ramesh Kumar'
  },
  {
    id: '2',
    inquiryNumber: 'INQ-2024-002',
    customer: 'Gupta Packaging Ltd',
    contactPerson: 'Anil Gupta',
    phone: '+91-9876543220',
    email: 'anil@guptapkg.com',
    inquiryDate: '2024-01-18',
    source: 'WhatsApp',
    requirements: [
      { id: 'r3', materialId: '1', materialCode: 'ITC/FBB/300/23x36/Sheet', gsm: 300, size: '23x36', packingType: 'Sheet', quantity: 15000, unit: 'KG', requiredDeliveryDate: '2024-01-30', deliveryLocation: 'Pithampur Factory', urgency: 'Critical', physicalStock: 0, transitStock: 0, coveragePercentage: 0, millConfirmationRequired: true, suggestedMill: 'ITC Paperboards' }
    ],
    status: 'Waiting Mill Confirmation',
    priority: 'Urgent',
    notes: 'Urgent requirement for new order',
    salesman: 'Suresh Patel'
  },
  {
    id: '3',
    inquiryNumber: 'INQ-2024-003',
    customer: 'Raj Printers Pvt Ltd',
    contactPerson: 'Raj Kumar',
    phone: '+91-9876543210',
    inquiryDate: '2024-01-10',
    source: 'Email',
    requirements: [
      { id: 'r4', materialId: '1', materialCode: 'ITC/FBB/300/23x36/Sheet', gsm: 300, size: '23x36', packingType: 'Sheet', quantity: 8000, unit: 'Sheet', requiredDeliveryDate: '2024-01-28', deliveryLocation: 'Dewas Plant', urgency: 'Normal', physicalStock: 12000, transitStock: 0, coveragePercentage: 150, millConfirmationRequired: false }
    ],
    status: 'Converted',
    priority: 'Medium',
    convertedToSO: 'SO-2024-001',
    salesman: 'Ramesh Kumar'
  },
  {
    id: '4',
    inquiryNumber: 'INQ-2024-004',
    customer: 'Raj Printers Pvt Ltd',
    contactPerson: 'Raj Kumar',
    phone: '+91-9876543210',
    email: 'raj@rajprinters.com',
    inquiryDate: '2024-01-20',
    source: 'Visit',
    requirements: [
      { id: 'r5', materialId: '1', materialCode: 'ITC/FBB/300/23x36/Sheet', gsm: 300, size: '23x36', packingType: 'Sheet', quantity: 12000, unit: 'Sheet', requiredDeliveryDate: '2024-02-05', deliveryLocation: 'Indore Warehouse', urgency: 'Normal', physicalStock: 5000, transitStock: 3000, coveragePercentage: 67, millConfirmationRequired: true },
      { id: 'r6', materialId: '2', materialCode: 'ITC/White Back/250/22x36/Sheet', gsm: 250, size: '22x36', packingType: 'Sheet', quantity: 6000, unit: 'Sheet', requiredDeliveryDate: '2024-02-02', deliveryLocation: 'Indore Warehouse', urgency: 'Urgent', physicalStock: 0, transitStock: 0, coveragePercentage: 0, millConfirmationRequired: true }
    ],
    status: 'Confirmed',
    priority: 'High',
    notes: 'Customer wants priority delivery, rates confirmed',
    salesman: 'Ramesh Kumar'
  },
  {
    id: '5',
    inquiryNumber: 'INQ-2024-005',
    customer: 'Gupta Packaging Ltd',
    contactPerson: 'Anil Gupta',
    phone: '+91-9876543220',
    email: 'anil@guptapkg.com',
    inquiryDate: '2024-01-22',
    source: 'Phone',
    requirements: [
      { id: 'r7', materialId: '2', materialCode: 'ITC/White Back/250/22x36/Sheet', gsm: 250, size: '22x36', packingType: 'Sheet', quantity: 20000, unit: 'KG', requiredDeliveryDate: '2024-02-15', deliveryLocation: 'Pithampur Factory', urgency: 'Normal', physicalStock: 15000, transitStock: 10000, coveragePercentage: 125, millConfirmationRequired: false }
    ],
    status: 'Confirmed',
    priority: 'High',
    notes: 'Large order, confirmed with mill, rates agreed',
    salesman: 'Suresh Patel'
  }
];
export const mockSalesOrders: SalesOrder[] = [
  {
    id: '1',
    soNumber: 'SO-2024-001',
    customer: 'Raj Printers Pvt Ltd',
    contactPerson: 'Raj Kumar',
    salesman: 'Ramesh Kumar',
    orderDate: '2024-01-10',
    lines: [
      {
        id: 'sol-1',
        lineNumber: 1,
        materialId: '1',
        materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet',
        gsm: 300,
        size: '23x36',
        packingType: 'Sheet',
        unit: 'KG',
        orderedQty: 8000,
        rate: 92.00,
        amount: 736000,
        deliveryAddress: '123 Industrial Area, Indore',
        requiredDeliveryDate: '2024-01-25',
        physicalStock: 10000,
        transitStock: 0,
        coveragePercentage: 125,
        purchaseRequired: 0,
        stockAllocated: 8000,
        transitAllocated: 0,
        purchaseAllocated: 0,
        allocationType: 'Stock',
        status: 'Allocated'
      }
    ],
    totalValue: 736000,
    status: 'Fully Allocated',
    paymentTerms: '30 Days',
    deliveryTerms: 'Door Delivery',
    deliveryMode: 'From Stock',
    inquiryRef: 'INQ-2024-003',
    remarks: 'Urgent delivery required'
  },
  {
    id: '2',
    soNumber: 'SO-2024-002',
    customer: 'Gupta Packaging Ltd',
    contactPerson: 'Anil Gupta',
    salesman: 'Suresh Patel',
    orderDate: '2024-01-18',
    lines: [
      {
        id: 'sol-2',
        lineNumber: 1,
        materialId: '3',
        materialCode: 'ITC Paperboards/Grey Back/200/24x36/Sheet',
        gsm: 200,
        size: '24x36',
        packingType: 'Sheet',
        unit: 'KG',
        orderedQty: 15000,
        rate: 65.00,
        amount: 975000,
        deliveryAddress: 'Plot 101, Industrial Area, Pithampur',
        requiredDeliveryDate: '2024-02-05',
        physicalStock: 7000,
        transitStock: 3000,
        coveragePercentage: 67,
        purchaseRequired: 5000,
        stockAllocated: 7000,
        transitAllocated: 3000,
        purchaseAllocated: 5000,
        allocationType: 'Mixed',
        status: 'In Progress'
      },
      {
        id: 'sol-3',
        lineNumber: 2,
        materialId: '2',
        materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet',
        gsm: 250,
        size: '22x36',
        packingType: 'Sheet',
        unit: 'KG',
        orderedQty: 5000,
        rate: 72.00,
        amount: 360000,
        deliveryAddress: 'Plot 101, Industrial Area, Pithampur',
        requiredDeliveryDate: '2024-02-08',
        physicalStock: 6000,
        transitStock: 0,
        coveragePercentage: 120,
        purchaseRequired: 0,
        stockAllocated: 5000,
        transitAllocated: 0,
        purchaseAllocated: 0,
        allocationType: 'Stock',
        status: 'Allocated'
      }
    ],
    totalValue: 1335000,
    status: 'In Dispatch',
    paymentTerms: '30 Days',
    deliveryTerms: 'Ex-Godown',
    deliveryMode: 'Mixed',
    remarks: 'Partial stock available, PO raised for balance'
  },
  {
    id: '3',
    soNumber: 'SO-2024-003',
    customer: 'Raj Printers Pvt Ltd',
    contactPerson: 'Sunil Kumar',
    salesman: 'Ramesh Kumar',
    orderDate: '2024-01-22',
    lines: [
      {
        id: 'sol-4',
        lineNumber: 1,
        materialId: '4',
        materialCode: 'JK Paper/White Back/280/23x36/Sheet',
        gsm: 280,
        size: '23x36',
        packingType: 'Sheet',
        unit: 'KG',
        orderedQty: 12000,
        rate: 110.00,
        amount: 1320000,
        deliveryAddress: '456 MG Road, Indore',
        requiredDeliveryDate: '2024-02-10',
        physicalStock: 0,
        transitStock: 0,
        coveragePercentage: 0,
        purchaseRequired: 12000,
        stockAllocated: 0,
        transitAllocated: 0,
        purchaseAllocated: 12000,
        allocationType: 'Purchase',
        status: 'In Progress'
      }
    ],
    totalValue: 1320000,
    status: 'Partially Allocated',
    paymentTerms: '45 Days',
    deliveryTerms: 'Door Delivery',
    deliveryMode: 'Direct Mill Delivery',
    remarks: 'Complete order to be procured from mill'
  },
  {
    id: '4',
    soNumber: 'SO-2024-004',
    customer: 'Gupta Packaging Ltd',
    contactPerson: 'Anil Gupta',
    salesman: 'Suresh Patel',
    orderDate: '2024-01-25',
    lines: [
      {
        id: 'sol-5',
        lineNumber: 1,
        materialId: '3',
        materialCode: 'ITC Paperboards/Grey Back/200/24x36/Sheet',
        gsm: 200,
        size: '24x36',
        packingType: 'Sheet',
        unit: 'KG',
        orderedQty: 10000,
        rate: 82.00,
        amount: 820000,
        deliveryAddress: 'Plot 101, Industrial Area, Pithampur',
        requiredDeliveryDate: '2024-02-15',
        status: 'Pending Allocation'
      }
    ],
    totalValue: 820000,
    status: 'Pending Allocation',
    paymentTerms: '30 Days',
    deliveryTerms: 'Door Delivery',
    deliveryMode: 'From Stock',
    remarks: 'Awaiting coverage check'
  },
  {
    id: '5',
    soNumber: 'SO-2024-005',
    customer: 'Raj Printers Pvt Ltd',
    contactPerson: 'Raj Kumar',
    salesman: 'Ramesh Kumar',
    orderDate: '2024-01-12',
    lines: [
      {
        id: 'sol-6',
        lineNumber: 1,
        materialId: '2',
        materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet',
        gsm: 250,
        size: '22x36',
        packingType: 'Sheet',
        unit: 'KG',
        orderedQty: 6000,
        rate: 75.00,
        amount: 450000,
        deliveryAddress: '123 Industrial Area, Indore',
        requiredDeliveryDate: '2024-01-20',
        physicalStock: 8000,
        transitStock: 0,
        coveragePercentage: 133,
        purchaseRequired: 0,
        stockAllocated: 6000,
        transitAllocated: 0,
        purchaseAllocated: 0,
        allocationType: 'Stock',
        status: 'Dispatched'
      }
    ],
    totalValue: 450000,
    status: 'Completed',
    paymentTerms: 'Advance',
    deliveryTerms: 'Door Delivery',
    deliveryMode: 'From Stock',
    remarks: 'Dispatched on 2024-01-19'
  }
];
export const mockBinLocations: BinLocation[] = [
  { id: '1', warehouse: 'Lasudia', zone: 'A', rack: '1', rackNo: 1, rowNo: 1, bin: 'A1', fullCode: 'Lasudia-A-1-A1', capacity: 15000, occupied: 10000, available: 5000, status: 'Active' },
  { id: '2', warehouse: 'Lasudia', zone: 'A', rack: '1', rackNo: 1, rowNo: 2, bin: 'A2', fullCode: 'Lasudia-A-1-A2', capacity: 15000, occupied: 8000, available: 7000, status: 'Active' },
  { id: '3', warehouse: 'Lasudia', zone: 'A', rack: '2', rackNo: 2, rowNo: 1, bin: 'B1', fullCode: 'Lasudia-A-2-B1', capacity: 15000, occupied: 15000, available: 0, status: 'Full' },
  { id: '4', warehouse: 'Lasudia', zone: 'A', rack: '2', rackNo: 2, rowNo: 2, bin: 'B2', fullCode: 'Lasudia-A-2-B2', capacity: 15000, occupied: 6000, available: 9000, status: 'Active' },
  { id: '5', warehouse: 'Lasudia', zone: 'B', rack: '1', rackNo: 1, rowNo: 1, bin: 'A1', fullCode: 'Lasudia-B-1-A1', capacity: 20000, occupied: 12000, available: 8000, status: 'Active' },
  { id: '6', warehouse: 'Lasudia', zone: 'B', rack: '1', rackNo: 1, rowNo: 2, bin: 'A2', fullCode: 'Lasudia-B-1-A2', capacity: 20000, occupied: 0, available: 20000, status: 'Maintenance' },
  { id: '7', warehouse: 'Sanwer', zone: 'A', rack: '1', rackNo: 1, rowNo: 1, bin: 'A1', fullCode: 'Sanwer-A-1-A1', capacity: 18000, occupied: 14000, available: 4000, status: 'Active' },
  { id: '8', warehouse: 'Sanwer', zone: 'A', rack: '1', rackNo: 1, rowNo: 2, bin: 'A2', fullCode: 'Sanwer-A-1-A2', capacity: 18000, occupied: 7000, available: 11000, status: 'Active' },
  { id: '9', warehouse: 'Sanwer', zone: 'A', rack: '2', rackNo: 2, rowNo: 1, bin: 'B1', fullCode: 'Sanwer-A-2-B1', capacity: 18000, occupied: 18000, available: 0, status: 'Full' },
  { id: '10', warehouse: 'Sanwer', zone: 'B', rack: '1', rackNo: 1, rowNo: 1, bin: 'A1', fullCode: 'Sanwer-B-1-A1', capacity: 20000, occupied: 5000, available: 15000, status: 'Active' },
  { id: '11', warehouse: 'Pithampur', zone: 'A', rack: '1', rackNo: 1, rowNo: 1, bin: 'A1', fullCode: 'Pithampur-A-1-A1', capacity: 25000, occupied: 20000, available: 5000, status: 'Active' },
  { id: '12', warehouse: 'Pithampur', zone: 'A', rack: '1', rackNo: 1, rowNo: 2, bin: 'A2', fullCode: 'Pithampur-A-1-A2', capacity: 25000, occupied: 10000, available: 15000, status: 'Active' },
  { id: '13', warehouse: 'Pithampur', zone: 'A', rack: '2', rackNo: 2, rowNo: 1, bin: 'B1', fullCode: 'Pithampur-A-2-B1', capacity: 25000, occupied: 8000, available: 17000, status: 'Active' },
  { id: '14', warehouse: 'Pithampur', zone: 'B', rack: '1', rackNo: 1, rowNo: 1, bin: 'A1', fullCode: 'Pithampur-B-1-A1', capacity: 30000, occupied: 25000, available: 5000, status: 'Active' },
  { id: '15', warehouse: 'Pithampur', zone: 'B', rack: '1', rackNo: 1, rowNo: 2, bin: 'A2', fullCode: 'Pithampur-B-1-A2', capacity: 30000, occupied: 0, available: 30000, status: 'Active' },
];

export const mockStockLots: StockLot[] = [
  {
    id: '1',
    lotNumber: 'LOT-2024-001',
    paper: 'FBB White Back',
    materialId: '1',
    gsm: 300,
    size: '23x36',
    mill: 'ITC Paperboards',
    receivedQty: 10000,
    currentQty: 10000,
    allocatedQty: 8000,
    availableQty: 2000,
    receivedDate: '2024-01-10',
    grnNumber: 'GRN-2024-001',
    binLocation: 'Lasudia-A-1-A1',
    warehouse: 'Lasudia',
    status: 'Allocated',
    quality: 'A Grade'
  },
  {
    id: '2',
    lotNumber: 'LOT-2024-002',
    paper: 'FBB White Back',
    materialId: '2',
    gsm: 250,
    size: '20x30',
    mill: 'ITC Paperboards',
    receivedQty: 8000,
    currentQty: 8000,
    allocatedQty: 6000,
    availableQty: 2000,
    receivedDate: '2024-01-12',
    grnNumber: 'GRN-2024-002',
    binLocation: 'Lasudia-A-1-A2',
    warehouse: 'Lasudia',
    status: 'Allocated',
    quality: 'A Grade'
  },
  {
    id: '3',
    lotNumber: 'LOT-2024-003',
    paper: 'Duplex Board',
    gsm: 250,
    size: '20x30',
    mill: 'ITC Paperboards',
    receivedQty: 6000,
    currentQty: 6000,
    allocatedQty: 5000,
    availableQty: 1000,
    receivedDate: '2024-01-15',
    grnNumber: 'GRN-2024-003',
    binLocation: 'Lasudia-A-2-B1',
    warehouse: 'Lasudia',
    status: 'Allocated',
    quality: 'A Grade'
  },
  {
    id: '4',
    lotNumber: 'LOT-2024-004',
    paper: 'Kraft Paper',
    materialId: '3',
    gsm: 200,
    size: '24x36',
    mill: 'ITC Paperboards',
    receivedQty: 7000,
    currentQty: 7000,
    allocatedQty: 7000,
    availableQty: 0,
    receivedDate: '2024-01-08',
    grnNumber: 'GRN-2024-004',
    binLocation: 'Lasudia-A-2-B2',
    warehouse: 'Lasudia',
    status: 'Allocated',
    quality: 'A Grade'
  },
  {
    id: '5',
    lotNumber: 'LOT-2024-005',
    paper: 'FBB Grey Back',
    gsm: 280,
    size: '23x36',
    mill: 'ITC Paperboards',
    receivedQty: 12000,
    currentQty: 12000,
    allocatedQty: 0,
    availableQty: 12000,
    receivedDate: '2024-01-20',
    grnNumber: 'GRN-2024-005',
    binLocation: 'Lasudia-B-1-A1',
    warehouse: 'Lasudia',
    status: 'Available',
    quality: 'A Grade'
  },
  {
    id: '6',
    lotNumber: 'LOT-2024-006',
    paper: 'SBS Board',
    gsm: 320,
    size: '23x36',
    mill: 'ITC Paperboards',
    receivedQty: 14000,
    currentQty: 14000,
    allocatedQty: 0,
    availableQty: 14000,
    receivedDate: '2024-01-22',
    grnNumber: 'GRN-2024-006',
    binLocation: 'Sanwer-A-1-A1',
    warehouse: 'Sanwer',
    status: 'Available',
    quality: 'A Grade'
  },
  {
    id: '7',
    lotNumber: 'LOT-2024-007',
    paper: 'FBB White Back',
    materialId: '4',
    gsm: 350,
    size: '23x36',
    mill: 'ITC Paperboards',
    receivedQty: 7000,
    currentQty: 7000,
    allocatedQty: 0,
    availableQty: 7000,
    receivedDate: '2024-01-25',
    grnNumber: 'GRN-2024-007',
    binLocation: 'Sanwer-A-1-A2',
    warehouse: 'Sanwer',
    status: 'Available',
    quality: 'A Grade'
  },
  {
    id: '8',
    lotNumber: 'LOT-2024-008',
    paper: 'Duplex Board',
    gsm: 300,
    size: '23x36',
    mill: 'ITC Paperboards',
    receivedQty: 18000,
    currentQty: 18000,
    allocatedQty: 0,
    availableQty: 18000,
    receivedDate: '2024-01-18',
    grnNumber: 'GRN-2024-008',
    binLocation: 'Sanwer-A-2-B1',
    warehouse: 'Sanwer',
    status: 'Available',
    quality: 'A Grade'
  },
  {
    id: '9',
    lotNumber: 'LOT-2024-009',
    paper: 'Kraft Paper',
    gsm: 180,
    size: '22x34',
    mill: 'ITC Paperboards',
    receivedQty: 5000,
    currentQty: 5000,
    allocatedQty: 0,
    availableQty: 5000,
    receivedDate: '2024-01-16',
    grnNumber: 'GRN-2024-009',
    binLocation: 'Sanwer-B-1-A1',
    warehouse: 'Sanwer',
    status: 'Available',
    quality: 'B Grade'
  },
  {
    id: '10',
    lotNumber: 'LOT-2024-010',
    paper: 'FBB White Back',
    materialId: '1',
    gsm: 300,
    size: '23x36',
    mill: 'ITC Paperboards',
    receivedQty: 20000,
    currentQty: 20000,
    allocatedQty: 0,
    availableQty: 20000,
    receivedDate: '2024-01-28',
    grnNumber: 'GRN-2024-010',
    binLocation: 'Pithampur-A-1-A1',
    warehouse: 'Pithampur',
    status: 'Available',
    quality: 'A Grade'
  },
  {
    id: '11',
    lotNumber: 'LOT-2023-098',
    paper: 'FBB White Back',
    gsm: 280,
    size: '20x30',
    mill: 'ITC Paperboards',
    receivedQty: 5000,
    currentQty: 0,
    allocatedQty: 0,
    availableQty: 0,
    receivedDate: '2023-12-15',
    grnNumber: 'GRN-2023-098',
    binLocation: 'Pithampur-A-1-A2',
    warehouse: 'Pithampur',
    status: 'Depleted',
    quality: 'A Grade'
  }
];
export const mockStock: Stock[] = [];
export const mockStockAllocations: StockAllocation[] = [];
export const mockPurchaseAllocations: PurchaseAllocation[] = [];
export const mockPickPlans: PickPlan[] = [
  {
    id: '1',
    pickPlanNumber: 'PICK-2024-001',
    soNumber: 'SO-2024-001',
    customer: 'Raj Printers',
    warehouse: 'Lasudia',
    totalQty: 8000,
    createdDate: '2024-01-11',
    plannedPickDate: '2024-01-24',
    assignedTo: 'Warehouse Team A',
    status: 'Completed',
    completedAt: '2024-01-24 16:30',
    lines: [
      {
        id: 'pl-1',
        soLineId: 'sol-1',
        paper: 'FBB White Back',
        gsm: 300,
        size: '23x36',
        qtyToPick: 8000,
        lotNumber: 'LOT-2024-001',
        binLocation: 'Lasudia-A-1-A1',
        qtyFromThisLot: 8000,
        pickSequence: 1,
        picked: true
      }
    ]
  },
  {
    id: '2',
    pickPlanNumber: 'PICK-2024-002',
    soNumber: 'SO-2024-002',
    customer: 'ABC Packaging',
    warehouse: 'Lasudia',
    totalQty: 12000,
    createdDate: '2024-01-19',
    plannedPickDate: '2024-02-04',
    assignedTo: 'Warehouse Team B',
    status: 'In Progress',
    lines: [
      {
        id: 'pl-2',
        soLineId: 'sol-2',
        paper: 'Kraft Paper',
        gsm: 200,
        size: '24x36',
        qtyToPick: 7000,
        lotNumber: 'LOT-2024-004',
        binLocation: 'Lasudia-A-2-B2',
        qtyFromThisLot: 7000,
        pickSequence: 1,
        picked: true
      },
      {
        id: 'pl-3',
        soLineId: 'sol-3',
        paper: 'Duplex Board',
        gsm: 250,
        size: '20x30',
        qtyToPick: 5000,
        lotNumber: 'LOT-2024-003',
        binLocation: 'Lasudia-A-2-B1',
        qtyFromThisLot: 5000,
        pickSequence: 2,
        picked: false
      }
    ]
  },
  {
    id: '3',
    pickPlanNumber: 'PICK-2024-003',
    soNumber: 'SO-2024-004',
    customer: 'Modern Printers',
    warehouse: 'Lasudia',
    totalQty: 10000,
    createdDate: '2024-01-26',
    plannedPickDate: '2024-02-14',
    assignedTo: 'Warehouse Team A',
    status: 'Pending',
    lines: [
      {
        id: 'pl-4',
        soLineId: 'sol-5',
        paper: 'FBB Grey Back',
        gsm: 280,
        size: '23x36',
        qtyToPick: 10000,
        lotNumber: 'LOT-2024-005',
        binLocation: 'Lasudia-B-1-A1',
        qtyFromThisLot: 10000,
        pickSequence: 1,
        picked: false
      }
    ]
  },
  {
    id: '4',
    pickPlanNumber: 'PICK-2024-004',
    soNumber: 'SO-2024-005',
    customer: 'Quick Print Solutions',
    warehouse: 'Lasudia',
    totalQty: 6000,
    createdDate: '2024-01-13',
    plannedPickDate: '2024-01-19',
    assignedTo: 'Warehouse Team B',
    status: 'Completed',
    completedAt: '2024-01-19 14:00',
    lines: [
      {
        id: 'pl-5',
        soLineId: 'sol-6',
        paper: 'FBB White Back',
        gsm: 250,
        size: '20x30',
        qtyToPick: 6000,
        lotNumber: 'LOT-2024-002',
        binLocation: 'Lasudia-A-1-A2',
        qtyFromThisLot: 6000,
        pickSequence: 1,
        picked: true
      }
    ]
  }
];
export const mockChallans: Challan[] = [
  {
    id: '1',
    challanNumber: 'CH-2024-001',
    challanDate: '2024-01-24',
    soNumber: 'SO-2024-001',
    pickPlanNumber: 'PP-2024-001',
    truckLoadPlanNumber: 'TLP-2024-001',
    customer: 'Raj Printers',
    customerAddress: 'Industrial Area, Indore',
    deliveryMode: 'Direct To Customer',
    warehouse: 'Lasudia',
    expectedDeliveryDate: '2024-01-25',
    lines: [
      {
        id: 'chl-1',
        soLineId: 'sol-1',
        paper: 'FBB White Back',
        gsm: 300,
        size: '23x36',
        orderedQty: 10000,
        pickedQty: 8000,
        quantity: 8000,
        lotNumber: 'LOT-2024-001',
        binLocation: 'Lasudia-A-1-A1'
      }
    ],
    totalQty: 8000,
    totalWeight: 4800,
    truckNumber: 'MP09AB1234',
    driverName: 'Rajesh Sharma',
    driverPhone: '+91-9876501111',
    transporterName: 'Shree Maruti Courier',
    loadingStartTime: '2024-01-24 09:00',
    loadingEndTime: '2024-01-24 10:30',
    loadedBy: 'Warehouse Team A',
    numberOfBundles: 16,
    weightKg: 4800,
    lrNumber: 'LR-2024-0051',
    eWayBillNumber: 'EWB-331200045678',
    gateOutTime: '2024-01-24 10:45',
    dispatchTime: '2024-01-24 10:45',
    transportCost: 4500,
    status: 'Dispatched',
    invoiceNumber: 'INV-2024-001',
    invoiceEligible: true,
    inTransitTrackingId: 'TRK-2024-001'
  },
  {
    id: '2',
    challanNumber: 'CH-2024-002',
    challanDate: '2024-01-19',
    soNumber: 'SO-2024-005',
    pickPlanNumber: 'PP-2024-002',
    truckLoadPlanNumber: 'TLP-2024-002',
    customer: 'Quick Print Solutions',
    customerAddress: 'AB Road, Indore',
    deliveryMode: 'Direct To Customer',
    warehouse: 'Lasudia',
    expectedDeliveryDate: '2024-01-20',
    lines: [
      {
        id: 'chl-2',
        soLineId: 'sol-6',
        paper: 'FBB White Back',
        gsm: 250,
        size: '20x30',
        orderedQty: 8000,
        pickedQty: 6000,
        quantity: 6000,
        lotNumber: 'LOT-2024-002',
        binLocation: 'Lasudia-A-1-A2'
      }
    ],
    totalQty: 6000,
    totalWeight: 3000,
    truckNumber: 'MP09CD5678',
    driverName: 'Suresh Kumar',
    driverPhone: '+91-9876502222',
    transporterName: 'Raj Transport',
    loadingStartTime: '2024-01-19 14:00',
    loadingEndTime: '2024-01-19 15:15',
    loadedBy: 'Warehouse Team B',
    numberOfBundles: 12,
    weightKg: 3000,
    lrNumber: 'LR-2024-0048',
    eWayBillNumber: 'EWB-331200045123',
    gateOutTime: '2024-01-19 15:30',
    dispatchTime: '2024-01-19 15:30',
    transportCost: 3200,
    status: 'Dispatched',
    invoiceNumber: 'INV-2024-002',
    invoiceEligible: true,
    inTransitTrackingId: 'TRK-2024-002'
  },
  {
    id: '3',
    challanNumber: 'CH-2024-003',
    challanDate: '2024-01-25',
    soNumber: 'SO-2024-002',
    pickPlanNumber: 'PP-2024-003',
    truckLoadPlanNumber: 'TLP-2024-003',
    customer: 'ABC Packaging',
    customerAddress: 'MIG Colony, Indore',
    deliveryMode: 'Direct To Customer',
    warehouse: 'Lasudia',
    expectedDeliveryDate: '2024-01-26',
    lines: [
      {
        id: 'chl-3',
        soLineId: 'sol-2',
        paper: 'Kraft Paper',
        gsm: 200,
        size: '24x36',
        orderedQty: 8000,
        pickedQty: 7000,
        quantity: 7000,
        lotNumber: 'LOT-2024-004',
        binLocation: 'Lasudia-A-2-B2'
      },
      {
        id: 'chl-4',
        soLineId: 'sol-3',
        paper: 'Duplex Board',
        gsm: 250,
        size: '20x30',
        orderedQty: 6000,
        pickedQty: 5000,
        quantity: 5000,
        lotNumber: 'LOT-2024-003',
        binLocation: 'Lasudia-A-2-B1'
      }
    ],
    totalQty: 12000,
    totalWeight: 6500,
    truckNumber: 'MP09EF9012',
    driverName: 'Amit Patel',
    driverPhone: '+91-9876503333',
    transporterName: 'Om Logistics',
    loadingStartTime: '2024-01-25 11:00',
    loadingEndTime: '2024-01-25 13:00',
    loadedBy: 'Warehouse Team A',
    numberOfBundles: 24,
    weightKg: 6500,
    status: 'Loaded',
    invoiceEligible: false
  },
  {
    id: '4',
    challanNumber: 'CH-2024-004',
    challanDate: '2024-01-26',
    soNumber: 'SO-2024-004',
    pickPlanNumber: 'PP-2024-004',
    truckLoadPlanNumber: 'TLP-2024-004',
    customer: 'Modern Printers',
    customerAddress: 'Vijay Nagar, Indore',
    deliveryMode: 'Direct To Customer',
    warehouse: 'Lasudia',
    expectedDeliveryDate: '2024-01-27',
    lines: [
      {
        id: 'chl-5',
        soLineId: 'sol-5',
        paper: 'FBB Grey Back',
        gsm: 280,
        size: '23x36',
        orderedQty: 12000,
        pickedQty: 10000,
        quantity: 10000,
        lotNumber: 'LOT-2024-005',
        binLocation: 'Lasudia-B-1-A1'
      }
    ],
    totalQty: 10000,
    totalWeight: 5600,
    truckNumber: 'MP09GH3456',
    driverName: 'Vijay Singh',
    driverPhone: '+91-9876504444',
    transporterName: 'National Transport',
    loadingStartTime: '2024-01-26 10:30',
    status: 'Loading',
    invoiceEligible: false
  },
  {
    id: '5',
    challanNumber: 'CH-2024-005',
    challanDate: '2024-01-27',
    soNumber: 'SO-2024-006',
    pickPlanNumber: 'PP-2024-005',
    truckLoadPlanNumber: 'TLP-2024-005',
    customer: 'Star Offset Press',
    customerAddress: 'Pithampur Industrial Area',
    deliveryMode: 'Direct To Customer',
    warehouse: 'Lasudia',
    expectedDeliveryDate: '2024-01-28',
    lines: [
      {
        id: 'chl-6',
        soLineId: 'sol-7',
        paper: 'Art Paper',
        gsm: 130,
        size: '23x36',
        orderedQty: 15000,
        pickedQty: 15000,
        quantity: 15000,
        lotNumber: 'LOT-2024-006',
        binLocation: 'Lasudia-B-2-A1'
      }
    ],
    totalQty: 15000,
    totalWeight: 4095,
    truckNumber: 'MP09JK7890',
    driverName: 'Kamal Verma',
    driverPhone: '+91-9876505555',
    transporterName: 'Express Cargo',
    status: 'Ready',
    invoiceEligible: false
  },
  {
    id: '6',
    challanNumber: 'CH-2024-006',
    challanDate: '2024-01-27',
    soNumber: 'SO-2024-007',
    pickPlanNumber: 'PP-2024-006',
    truckLoadPlanNumber: 'TLP-2024-006',
    customer: 'Indore Packaging Co.',
    customerAddress: 'Sanwer Road, Indore',
    deliveryMode: 'To Godown',
    warehouse: 'Lasudia',
    expectedDeliveryDate: '2024-01-29',
    lines: [
      {
        id: 'chl-7',
        soLineId: 'sol-8',
        paper: 'Maplitho',
        gsm: 80,
        size: '23x36',
        orderedQty: 20000,
        pickedQty: 20000,
        quantity: 20000,
        lotNumber: 'LOT-2024-007',
        binLocation: 'Lasudia-C-1-A1'
      }
    ],
    totalQty: 20000,
    totalWeight: 3312,
    truckNumber: 'MP09LM2345',
    driverName: 'Raju Yadav',
    driverPhone: '+91-9876506666',
    transporterName: 'Shree Ganesh Transport',
    status: 'Ready',
    invoiceEligible: false
  }
];
export const mockMillTrackers: MillOrderTracker[] = [
  {
    id: '1',
    poNumber: 'PO-2024-001',
    poItemId: '1-1',
    poDate: '2024-01-08',
    mill: 'ITC Paperboards',
    soNumber: 'SO-2024-003',
    customerName: 'Raj Printers Pvt Ltd',
    customerId: '1',
    paper: 'ITC Paperboards/FBB/300/23x36/Sheet',
    gsm: 300,
    size: '23x36',
    orderedQty: 12000,
    readyQty: 7800,
    dispatchedQty: 0,
    balanceQty: 12000,
    rate: 105.00,
    totalAmount: 1260000,
    expectedDelivery: '2024-02-08',
    productionStatus: 'In Production',
    productionProgress: 65,
    lastUpdate: '2024-01-26',
    lastUpdatedBy: 'Mill Team',
    deliveryMode: 'To Godown',
    remarks: 'Production on schedule, quality check planned for Feb 5'
  },
  {
    id: '2',
    poNumber: 'PO-2024-002',
    poItemId: '2-1',
    poDate: '2024-01-18',
    mill: 'ITC Paperboards',
    soNumber: undefined,
    paper: 'ITC Paperboards/White Back/250/22x36/Sheet',
    gsm: 250,
    size: '22x36',
    orderedQty: 8000,
    readyQty: 8000,
    dispatchedQty: 0,
    balanceQty: 8000,
    rate: 60.00,
    totalAmount: 480000,
    expectedDelivery: '2024-02-10',
    productionStatus: 'Ready',
    productionProgress: 100,
    lastUpdate: '2024-01-25',
    lastUpdatedBy: 'Mill Team',
    deliveryMode: 'To Godown',
    remarks: 'Batch completed, ready for dispatch'
  },
  {
    id: '3',
    poNumber: 'PO-2024-003',
    poItemId: '3-1',
    poDate: '2024-01-15',
    mill: 'ITC Paperboards',
    soNumber: 'SO-2024-001',
    customerName: 'Raj Printers Pvt Ltd',
    customerId: '1',
    paper: 'ITC Paperboards/FBB/300/23x36/Sheet',
    gsm: 300,
    size: '23x36',
    orderedQty: 20000,
    readyQty: 20000,
    dispatchedQty: 8000,
    balanceQty: 12000,
    rate: 88.00,
    totalAmount: 1760000,
    expectedDelivery: '2024-02-05',
    productionStatus: 'Partial Ready',
    productionProgress: 40,
    lastUpdate: '2024-01-30',
    lastUpdatedBy: 'Logistics Team',
    deliveryMode: 'Direct To Customer',
    remarks: 'First batch dispatched, balance ready for 2nd truck',
    partialDeliveries: [
      {
        id: 'pd1',
        batchNo: 1,
        date: '2024-01-30',
        qty: 8000,
        truckNumber: 'MH04AB1234',
        millInvoiceNo: 'MI-2024-002',
        remarks: 'First batch — urgent delivery, customer requested early shipment'
      }
    ]
  },
  {
    id: '4',
    poNumber: 'PO-2024-004',
    poItemId: '4-1',
    poDate: '2024-01-20',
    mill: 'ITC Paperboards',
    soNumber: undefined,
    paper: 'ITC Paperboards/Grey Back/220/24x36/Sheet',
    gsm: 220,
    size: '24x36',
    orderedQty: 15000,
    readyQty: 0,
    dispatchedQty: 0,
    balanceQty: 15000,
    rate: 85.00,
    totalAmount: 1275000,
    expectedDelivery: '2024-02-15',
    delayDays: 0,
    productionStatus: 'Order Placed',
    productionProgress: 0,
    lastUpdate: '2024-01-20',
    lastUpdatedBy: 'System',
    deliveryMode: 'To Godown',
    remarks: 'Order confirmed, production to start from Feb 1'
  },
  {
    id: '5',
    poNumber: 'PO-2024-005',
    poItemId: '5-1',
    poDate: '2024-01-12',
    mill: 'ITC Paperboards',
    soNumber: undefined,
    paper: 'ITC Paperboards/Grey Back/220/24x36/Sheet',
    gsm: 220,
    size: '24x36',
    orderedQty: 10000,
    readyQty: 10000,
    dispatchedQty: 10000,
    balanceQty: 0,
    rate: 80.00,
    totalAmount: 800000,
    expectedDelivery: '2024-01-28',
    actualDispatchDate: '2024-01-27',
    productionStatus: 'Dispatched',
    productionProgress: 100,
    lastUpdate: '2024-01-27',
    lastUpdatedBy: 'Logistics Team',
    deliveryMode: 'To Godown',
    millInvoiceNo: 'MI-2024-001',
    remarks: 'Dispatched on Jan 27, expected arrival Jan 30'
  },
  {
    id: '6',
    poNumber: 'PO-2024-006',
    poItemId: '6-1',
    poDate: '2024-01-22',
    mill: 'ITC Paperboards',
    soNumber: 'SO-2024-002',
    customerName: 'Gupta Packaging Ltd',
    customerId: '2',
    paper: 'ITC Paperboards/FBB/300/23x36/Sheet',
    gsm: 300,
    size: '23x36',
    orderedQty: 7000,
    readyQty: 3150,
    dispatchedQty: 0,
    balanceQty: 7000,
    rate: 95.00,
    totalAmount: 665000,
    expectedDelivery: '2024-02-12',
    productionStatus: 'Partial Ready',
    productionProgress: 45,
    lastUpdate: '2024-01-26',
    lastUpdatedBy: 'Mill Team',
    deliveryMode: 'Direct To Customer',
    remarks: 'Production ongoing, 45% complete'
  },
  {
    id: '7',
    poNumber: 'PO-2024-007',
    poItemId: '7-1',
    poDate: '2024-01-25',
    mill: 'JK Paper',
    soNumber: 'SO-2024-005',
    customerName: 'Raj Printers Pvt Ltd',
    customerId: '1',
    paper: 'JK Paper/White Back/250/22x36/Sheet',
    gsm: 250,
    size: '22x36',
    orderedQty: 10000,
    readyQty: 0,
    dispatchedQty: 0,
    balanceQty: 10000,
    rate: 72.00,
    totalAmount: 720000,
    expectedDelivery: '2024-02-20',
    productionStatus: 'Order Placed',
    productionProgress: 0,
    lastUpdate: '2024-01-25',
    lastUpdatedBy: 'System',
    deliveryMode: 'To Godown',
    remarks: 'Order confirmed with JK Paper, production to start Feb 5'
  },
  {
    id: '8',
    poNumber: 'PO-2024-008',
    poItemId: '8-1',
    poDate: '2024-01-28',
    mill: 'JK Paper',
    soNumber: 'SO-2024-002',
    customerName: 'Gupta Packaging Ltd',
    customerId: '2',
    paper: 'JK Paper/Coated/300/23x36/Sheet',
    gsm: 300,
    size: '23x36',
    orderedQty: 5000,
    readyQty: 5000,
    dispatchedQty: 0,
    balanceQty: 5000,
    rate: 98.00,
    totalAmount: 490000,
    expectedDelivery: '2024-02-14',
    productionStatus: 'Ready',
    productionProgress: 100,
    lastUpdate: '2024-01-30',
    lastUpdatedBy: 'Mill Team',
    deliveryMode: 'Direct To Customer',
    remarks: 'Ready for dispatch, awaiting truck arrangement'
  }
];
export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: '1',
    poNumber: 'PO-2024-001',
    mill: 'ITC Paperboards',
    millId: '1',
    orderDate: '2024-01-08',
    poType: 'Against Sales Order',
    linkedSONumber: 'SO-2024-003',
    deliveryMode: 'To Godown',
    expectedDispatchDate: '2024-02-05',
    expectedDeliveryDate: '2024-02-08',
    paymentTerms: '30 Days',
    freightType: 'To Pay',
    items: [
      {
        id: '1-1',
        itemNumber: 1,
        materialId: '1',
        materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet',
        categoryName: 'FBB',
        gsm: 300,
        size: '23x36',
        packingType: 'Sheet',
        orderedQty: 12000,
        readyQty: 5400,
        dispatchedQty: 0,
        pendingQty: 6600,
        rate: 105.00,
        amount: 1260000,
        soNumber: 'SO-2024-003',
        soLineId: '3-1',
        allocationType: 'Against SO',
        status: 'In Production'
      }
    ],
    totalQuantity: 12000,
    totalValue: 1260000,
    status: 'In Production',
    tallyLedgerName: 'ITC Paperboards & Specialty Papers Div',
    purchaseLedgerGroup: 'Purchase Accounts',
    gstPercentage: 18,
    trackerRef: '1',
    remarks: 'Linked to SO-2024-003'
  },
  {
    id: '2',
    poNumber: 'PO-2024-002',
    mill: 'ITC Paperboards',
    millId: '1',
    orderDate: '2024-01-18',
    poType: 'For Stock',
    deliveryMode: 'To Godown',
    expectedDispatchDate: '2024-02-08',
    expectedDeliveryDate: '2024-02-10',
    paymentTerms: '30 Days',
    freightType: 'To Pay',
    items: [
      {
        id: '2-1',
        itemNumber: 1,
        materialId: '2',
        materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet',
        categoryName: 'White Back',
        gsm: 250,
        size: '22x36',
        packingType: 'Sheet',
        orderedQty: 8000,
        readyQty: 8000,
        dispatchedQty: 0,
        pendingQty: 0,
        rate: 60.00,
        amount: 480000,
        allocationType: 'For Stock',
        status: 'Ready'
      }
    ],
    totalQuantity: 8000,
    totalValue: 480000,
    status: 'Ready',
    tallyLedgerName: 'ITC Paperboards & Specialty Papers Div',
    purchaseLedgerGroup: 'Purchase Accounts',
    gstPercentage: 18,
    trackerRef: '2',
    remarks: 'Quality check completed'
  },
  {
    id: '3',
    poNumber: 'PO-2024-003',
    mill: 'ITC Paperboards',
    millId: '1',
    orderDate: '2024-01-15',
    poType: 'Against Sales Order',
    linkedSONumber: 'SO-2024-001',
    deliveryMode: 'Direct To Customer',
    directCustomer: 'Raj Printers',
    directCustomerId: '1',
    directDeliveryAddress: 'Plot 12, Industrial Area, Sector 5, Pithampur - 454775',
    blindShipment: true,
    expectedDispatchDate: '2024-02-03',
    expectedDeliveryDate: '2024-02-05',
    paymentTerms: '30 Days',
    freightType: 'Included',
    items: [
      {
        id: '3-1',
        itemNumber: 1,
        materialId: '1',
        materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet',
        categoryName: 'FBB',
        gsm: 300,
        size: '23x36',
        packingType: 'Sheet',
        orderedQty: 20000,
        readyQty: 20000,
        dispatchedQty: 0,
        pendingQty: 0,
        rate: 88.00,
        amount: 1760000,
        soNumber: 'SO-2024-001',
        soLineId: '1-1',
        allocationType: 'Against SO',
        deliveryLocation: 'Raj Printers Factory',
        deliveryAddress: 'Plot 12, Industrial Area, Sector 5, Pithampur - 454775',
        status: 'Ready'
      }
    ],
    totalQuantity: 20000,
    totalValue: 1760000,
    status: 'Ready',
    tallyLedgerName: 'ITC Paperboards & Specialty Papers Div',
    purchaseLedgerGroup: 'Purchase Accounts',
    gstPercentage: 18,
    trackerRef: '3',
    remarks: 'Ready for dispatch, waiting for truck'
  },
  {
    id: '4',
    poNumber: 'PO-2024-004',
    mill: 'ITC Paperboards',
    millId: '1',
    orderDate: '2024-01-20',
    poType: 'For Stock',
    deliveryMode: 'To Godown',
    expectedDispatchDate: '2024-02-12',
    expectedDeliveryDate: '2024-02-15',
    paymentTerms: '30 Days',
    freightType: 'To Pay',
    items: [
      {
        id: '4-1',
        itemNumber: 1,
        materialId: '3',
        materialCode: 'ITC Paperboards/Grey Back/220/24x36/Sheet',
        categoryName: 'Grey Back',
        gsm: 220,
        size: '24x36',
        packingType: 'Sheet',
        orderedQty: 15000,
        readyQty: 0,
        dispatchedQty: 0,
        pendingQty: 15000,
        rate: 85.00,
        amount: 1275000,
        allocationType: 'For Stock',
        status: 'Pending'
      }
    ],
    totalQuantity: 15000,
    totalValue: 1275000,
    status: 'Acknowledged',
    tallyLedgerName: 'ITC Paperboards & Specialty Papers Div',
    purchaseLedgerGroup: 'Purchase Accounts',
    gstPercentage: 18,
    trackerRef: '4',
    remarks: 'Production to start Feb 1'
  },
  {
    id: '5',
    poNumber: 'PO-2024-005',
    mill: 'ITC Paperboards',
    millId: '1',
    orderDate: '2024-01-12',
    poType: 'For Stock',
    deliveryMode: 'To Godown',
    expectedDispatchDate: '2024-01-26',
    expectedDeliveryDate: '2024-01-28',
    paymentTerms: '30 Days',
    freightType: 'To Pay',
    items: [
      {
        id: '5-1',
        itemNumber: 1,
        materialId: '3',
        materialCode: 'ITC Paperboards/Grey Back/220/24x36/Sheet',
        categoryName: 'Grey Back',
        gsm: 220,
        size: '24x36',
        packingType: 'Sheet',
        orderedQty: 10000,
        readyQty: 10000,
        dispatchedQty: 10000,
        pendingQty: 0,
        rate: 80.00,
        amount: 800000,
        allocationType: 'For Stock',
        status: 'Dispatched'
      }
    ],
    totalQuantity: 10000,
    totalValue: 800000,
    status: 'Dispatched',
    tallyLedgerName: 'ITC Paperboards & Specialty Papers Div',
    purchaseLedgerGroup: 'Purchase Accounts',
    gstPercentage: 18,
    trackerRef: '5',
    remarks: 'Dispatched Jan 27'
  },
  {
    id: '6',
    poNumber: 'PO-2024-006',
    mill: 'ITC Paperboards',
    millId: '1',
    orderDate: '2024-01-22',
    poType: 'Against Sales Order',
    linkedSONumber: 'SO-2024-002',
    deliveryMode: 'Direct To Customer',
    directCustomer: 'ABC Printers',
    directCustomerId: '2',
    directDeliveryAddress: 'Plot 23, MIG Colony, AB Road, Indore - 452001',
    expectedDispatchDate: '2024-02-10',
    expectedDeliveryDate: '2024-02-12',
    paymentTerms: '45 Days',
    freightType: 'Included',
    items: [
      {
        id: '6-1',
        itemNumber: 1,
        materialId: '1',
        materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet',
        categoryName: 'FBB',
        gsm: 300,
        size: '23x36',
        packingType: 'Sheet',
        orderedQty: 7000,
        readyQty: 3150,
        dispatchedQty: 0,
        pendingQty: 3850,
        rate: 95.00,
        amount: 665000,
        soNumber: 'SO-2024-002',
        soLineId: '2-1',
        allocationType: 'Against SO',
        deliveryLocation: 'ABC Printers Factory',
        deliveryAddress: 'Plot 23, MIG Colony, AB Road, Indore - 452001',
        status: 'Partial Ready'
      }
    ],
    totalQuantity: 7000,
    totalValue: 665000,
    status: 'Partial Ready',
    tallyLedgerName: 'ITC Paperboards & Specialty Papers Div',
    purchaseLedgerGroup: 'Purchase Accounts',
    gstPercentage: 18,
    trackerRef: '6'
  },
  {
    id: '7',
    poNumber: 'PO-2024-007',
    mill: 'Khanna Paper Mills',
    millId: '2',
    orderDate: '2024-01-25',
    poType: 'For Stock',
    deliveryMode: 'To Godown',
    expectedDispatchDate: '2024-02-15',
    expectedDeliveryDate: '2024-02-18',
    paymentTerms: '30 Days',
    freightType: 'To Pay',
    items: [
      {
        id: '7-1',
        itemNumber: 1,
        materialId: '2',
        materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet',
        categoryName: 'White Back',
        gsm: 250,
        size: '22x36',
        packingType: 'Sheet',
        orderedQty: 10000,
        readyQty: 0,
        dispatchedQty: 0,
        pendingQty: 10000,
        rate: 72.00,
        amount: 720000,
        allocationType: 'For Stock',
        status: 'Pending'
      }
    ],
    totalQuantity: 10000,
    totalValue: 720000,
    status: 'Sent to Mill',
    tallyLedgerName: 'Khanna Paper Mills Ltd',
    purchaseLedgerGroup: 'Purchase Accounts',
    gstPercentage: 18,
    trackerRef: '7'
  }
];
export const mockTruckLoadPlans: TruckLoadPlan[] = [
  {
    id: '1',
    planNumber: 'TLP-2024-001',
    planDate: '2024-01-24',
    truckNumber: 'MP09AB1234',
    driverName: 'Rajesh Sharma',
    driverPhone: '+91-9876501111',
    transporterName: 'Shree Balaji Transport',
    truckCapacityKg: 15000,
    origin: 'Lasudia Godown',
    deliveryMode: 'Direct To Customer',
    plannedLoadDate: '2024-01-24',
    plannedDeliveryDate: '2024-01-24',
    actualLoadDate: '2024-01-24',
    actualDeliveryDate: '2024-01-24',
    status: 'Received',
    inTransitTrackerId: '1',
    items: [
      {
        id: 'tlp1-item1',
        poNumber: 'PO-2024-001',
        soNumber: 'SO-2024-001',
        paper: 'FBB White Back',
        gsm: 300,
        size: '23x36',
        quantity: 8000,
        weightKg: 5587,
        loadOrder: 1,
        customerName: 'Raj Printers',
        deliveryLocation: 'Raj Printers Factory',
        deliveryAddress: 'Plot 12, Industrial Area, Sector 5, Pithampur - 454775',
      },
    ],
  },
  {
    id: '2',
    planNumber: 'TLP-2024-002',
    planDate: '2024-01-19',
    truckNumber: 'MP09CD5678',
    driverName: 'Suresh Kumar',
    driverPhone: '+91-9876502222',
    transporterName: 'Rathi Roadways',
    truckCapacityKg: 10000,
    origin: 'Lasudia Godown',
    deliveryMode: 'Direct To Customer',
    plannedLoadDate: '2024-01-19',
    plannedDeliveryDate: '2024-01-19',
    actualLoadDate: '2024-01-19',
    actualDeliveryDate: '2024-01-19',
    status: 'Received',
    inTransitTrackerId: '2',
    items: [
      {
        id: 'tlp2-item1',
        poNumber: 'PO-2024-002',
        soNumber: 'SO-2024-005',
        paper: 'FBB White Back',
        gsm: 250,
        size: '20x30',
        quantity: 6000,
        weightKg: 2903,
        loadOrder: 1,
        customerName: 'Quick Print Solutions',
        deliveryLocation: 'ABC Printers Factory',
        deliveryAddress: 'Plot 23, MIG Colony, AB Road, Indore - 452001',
      },
    ],
  },
  {
    // Multi-item multi-stop truck — demo of the new model
    id: '3',
    planNumber: 'TLP-2024-003',
    planDate: '2024-01-25',
    truckNumber: 'MP09EF9012',
    driverName: 'Amit Patel',
    driverPhone: '+91-9876503333',
    transporterName: 'Naveen Transport',
    truckCapacityKg: 18000,
    origin: 'ITC Paperboards, Bhadrachalam',
    deliveryMode: 'Multi-Stop',
    plannedLoadDate: '2024-01-25',
    plannedDeliveryDate: '2024-01-27',
    actualLoadDate: '2024-01-25',
    status: 'Dispatched',
    inTransitTrackerId: '3',
    items: [
      {
        id: 'tlp3-item1',
        poNumber: 'PO-2024-003',
        soNumber: 'SO-2024-002',
        paper: 'Kraft Paper',
        gsm: 200,
        size: '24x36',
        quantity: 12000,
        weightKg: 8380,
        loadOrder: 2, // loaded second = delivered first (closer stop)
        customerName: 'Raj Printers',
        deliveryLocation: 'Pithampur Godown',
        deliveryAddress: 'Plot 45, Industrial Area, Pithampur - 454775',
      },
      {
        id: 'tlp3-item2',
        poNumber: 'PO-2024-004',
        soNumber: 'SO-2024-003',
        paper: 'FBB Grey Back',
        gsm: 280,
        size: '23x36',
        quantity: 5000,
        weightKg: 3492,
        loadOrder: 1, // loaded first = delivered last (farther stop)
        customerName: 'Modern Printers',
        deliveryLocation: 'Vijay Nagar Godown',
        deliveryAddress: '88, Vijay Nagar, Indore - 452010',
      },
    ],
  },
  {
    id: '4',
    planNumber: 'TLP-2024-004',
    planDate: '2024-01-26',
    truckNumber: 'MP09GH3456',
    driverName: 'Vijay Singh',
    driverPhone: '+91-9876504444',
    transporterName: 'Shree Balaji Transport',
    truckCapacityKg: 15000,
    origin: 'Lasudia Godown',
    deliveryMode: 'Direct To Customer',
    plannedLoadDate: '2024-01-26',
    plannedDeliveryDate: '2024-01-26',
    actualLoadDate: '2024-01-26',
    status: 'Dispatched',
    inTransitTrackerId: '4',
    items: [
      {
        id: 'tlp4-item1',
        poNumber: 'PO-2024-004',
        soNumber: 'SO-2024-004',
        paper: 'FBB Grey Back',
        gsm: 280,
        size: '23x36',
        quantity: 10000,
        weightKg: 6985,
        loadOrder: 1,
        customerName: 'Modern Printers',
        deliveryLocation: 'Modern Printers, Vijay Nagar',
        deliveryAddress: '88, Vijay Nagar, Indore - 452010',
      },
    ],
  },
  {
    id: '5',
    planNumber: 'TLP-MILL-001',
    planDate: '2024-01-27',
    truckNumber: 'TG12XY5678',
    driverName: 'Ramesh Yadav',
    driverPhone: '+91-9876505555',
    transporterName: 'Rathi Roadways',
    truckCapacityKg: 20000,
    origin: 'ITC Paperboards, Bhadrachalam',
    deliveryMode: 'To Godown',
    plannedLoadDate: '2024-01-27',
    plannedDeliveryDate: '2024-01-30',
    actualLoadDate: '2024-01-27',
    status: 'Dispatched',
    inTransitTrackerId: '5',
    items: [
      {
        id: 'tlp5-item1',
        poNumber: 'PO-2024-005',
        paper: 'FBB Grey Back',
        gsm: 280,
        size: '23x36',
        quantity: 10000,
        weightKg: 6985,
        loadOrder: 1,
        deliveryLocation: 'Lasudia Godown',
        deliveryAddress: 'Lasudia Godown, Indore',
        millInvoiceNo: 'ITC-INV-2024-0892',
      },
    ],
  },
  {
    id: '6',
    planNumber: 'TLP-2024-005',
    planDate: '2024-01-28',
    transporterName: 'Naveen Transport',
    truckCapacityKg: 20000,
    origin: 'ITC Paperboards, Bhadrachalam',
    deliveryMode: 'Direct To Customer',
    plannedLoadDate: '2024-01-30',
    plannedDeliveryDate: '2024-02-02',
    status: 'Planned',
    items: [
      {
        id: 'tlp6-item1',
        poNumber: 'PO-2024-003',
        paper: 'FBB White Back',
        gsm: 300,
        size: '23x36',
        quantity: 20000,
        weightKg: 13967,
        loadOrder: 1,
        deliveryLocation: 'Raj Printers Factory',
        deliveryAddress: 'Plot 12, Industrial Area, Sector 5, Pithampur - 454775',
      },
    ],
  },
];
export const mockInTransitTrackings: InTransitTracking[] = [
  {
    id: '1',
    trackingNumber: 'TRK-2024-001',
    loadPlanId: 'LP-2024-001',
    soNumber: 'SO-2024-001',
    challanNumber: 'CH-2024-001',
    truckNumber: 'MP09AB1234',
    driverName: 'Rajesh Sharma',
    driverPhone: '+91-9876501111',
    origin: 'Lasudia Godown, Indore',
    destination: 'Raj Printers, Industrial Area, Indore',
    deliveryMode: 'Direct To Customer',
    dispatchedDate: '2024-01-24',
    expectedArrival: '2024-01-24',
    currentLocation: 'Received',
    status: 'Received',
    locationUpdates: [
      { timestamp: '2024-01-24 10:30', location: 'Lasudia Godown', remarks: 'Loaded and dispatched' },
      { timestamp: '2024-01-24 11:15', location: 'AB Road', remarks: 'In transit' },
      { timestamp: '2024-01-24 12:00', location: 'Industrial Area', remarks: 'Reached destination' },
      { timestamp: '2024-01-24 12:45', location: 'Raj Printers', remarks: 'Delivered and signed' }
    ]
  },
  {
    id: '2',
    trackingNumber: 'TRK-2024-002',
    loadPlanId: 'LP-2024-002',
    soNumber: 'SO-2024-005',
    challanNumber: 'CH-2024-002',
    truckNumber: 'MP09CD5678',
    driverName: 'Suresh Kumar',
    driverPhone: '+91-9876502222',
    origin: 'Lasudia Godown, Indore',
    destination: 'Quick Print Solutions, AB Road, Indore',
    deliveryMode: 'Direct To Customer',
    dispatchedDate: '2024-01-19',
    expectedArrival: '2024-01-19',
    currentLocation: 'Received',
    status: 'Received',
    locationUpdates: [
      { timestamp: '2024-01-19 15:15', location: 'Lasudia Godown', remarks: 'Loaded and dispatched' },
      { timestamp: '2024-01-19 16:00', location: 'AB Road', remarks: 'Reached destination' },
      { timestamp: '2024-01-19 16:30', location: 'Quick Print Solutions', remarks: 'Delivered successfully' }
    ]
  },
  {
    id: '3',
    trackingNumber: 'TRK-2024-003',
    loadPlanId: 'LP-2024-003',
    soNumber: 'SO-2024-002',
    challanNumber: 'CH-2024-003',
    truckNumber: 'MP09EF9012',
    driverName: 'Amit Patel',
    driverPhone: '+91-9876503333',
    origin: 'Lasudia Godown, Indore',
    destination: 'Pithampur Godown',
    deliveryMode: 'To Godown',
    dispatchedDate: '2024-01-25',
    expectedArrival: '2024-01-26',
    currentLocation: 'Pithampur',
    status: 'Reached Destination',
    locationUpdates: [
      { timestamp: '2024-01-25 13:00', location: 'Lasudia Godown', remarks: 'Loaded and dispatched' },
      { timestamp: '2024-01-25 15:30', location: 'Dewas Bypass', remarks: 'In transit' },
      { timestamp: '2024-01-26 09:00', location: 'Pithampur', remarks: 'Reached godown, awaiting GRN' }
    ]
  },
  {
    id: '4',
    trackingNumber: 'TRK-2024-004',
    loadPlanId: 'LP-2024-004',
    soNumber: 'SO-2024-004',
    challanNumber: 'CH-2024-004',
    truckNumber: 'MP09GH3456',
    driverName: 'Vijay Singh',
    driverPhone: '+91-9876504444',
    origin: 'Lasudia Godown, Indore',
    destination: 'Modern Printers, Vijay Nagar, Indore',
    deliveryMode: 'Direct To Customer',
    dispatchedDate: '2024-01-26',
    expectedArrival: '2024-01-26',
    currentLocation: 'Ring Road',
    status: 'Dispatched',
    locationUpdates: [
      { timestamp: '2024-01-26 10:30', location: 'Lasudia Godown', remarks: 'Loading completed, dispatched' },
      { timestamp: '2024-01-26 11:15', location: 'Ring Road', remarks: 'In transit to Vijay Nagar' }
    ]
  },
  {
    id: '5',
    trackingNumber: 'TRK-MILL-001',
    loadPlanId: 'LP-MILL-001',
    poNumber: 'PO-MILL-2024-005',
    truckNumber: 'TG12XY5678',
    driverName: 'Ramesh Yadav',
    driverPhone: '+91-9876505555',
    origin: 'ITC Paperboards, Bhadrachalam',
    destination: 'Lasudia Godown, Indore',
    deliveryMode: 'To Godown',
    dispatchedDate: '2024-01-27',
    expectedArrival: '2024-01-30',
    currentLocation: 'Nagpur',
    status: 'Dispatched',
    locationUpdates: [
      { timestamp: '2024-01-27 08:00', location: 'ITC Paperboards, Bhadrachalam', remarks: 'Mill dispatch completed' },
      { timestamp: '2024-01-27 18:00', location: 'Hyderabad', remarks: 'Crossed Hyderabad checkpoint' },
      { timestamp: '2024-01-28 08:00', location: 'Nagpur', remarks: 'Stopover at Nagpur' }
    ]
  }
];
export const mockPurchaseInvoices: PurchaseInvoice[] = [
  {
    id: '1',
    purchaseInvoiceNumber: 'MILL-INV-2024-001',
    invoiceDate: '2024-01-10',
    mill: 'ITC Paperboards',
    poNumber: 'PO-2024-001',
    paper: 'FBB White Back',
    gsm: 300,
    size: '23x36',
    quantity: 10000,
    baseAmount: 880000,
    cgst: 79200,
    sgst: 79200,
    igst: 0,
    totalAmount: 1038400,
    deliveryMode: 'To Godown',
    grnNumber: 'GRN-2024-001',
    status: 'GRN Done',
    paymentStatus: 'Paid',
    paymentDueDate: '2024-02-10',
    paidAmount: 1038400
  },
  {
    id: '2',
    purchaseInvoiceNumber: 'MILL-INV-2024-002',
    invoiceDate: '2024-01-12',
    mill: 'ITC Paperboards',
    poNumber: 'PO-2024-002',
    paper: 'FBB White Back',
    gsm: 250,
    size: '20x30',
    quantity: 8000,
    baseAmount: 480000,
    cgst: 43200,
    sgst: 43200,
    igst: 0,
    totalAmount: 566400,
    deliveryMode: 'To Godown',
    grnNumber: 'GRN-2024-002',
    status: 'GRN Done',
    paymentStatus: 'Paid',
    paymentDueDate: '2024-02-12',
    paidAmount: 566400
  },
  {
    id: '3',
    purchaseInvoiceNumber: 'MILL-INV-2024-003',
    invoiceDate: '2024-01-27',
    mill: 'ITC Paperboards',
    poNumber: 'PO-2024-005',
    paper: 'FBB Grey Back',
    gsm: 280,
    size: '23x36',
    quantity: 10000,
    baseAmount: 800000,
    cgst: 0,
    sgst: 0,
    igst: 144000,
    totalAmount: 944000,
    deliveryMode: 'To Godown',
    status: 'Dispatched',
    paymentStatus: 'Pending',
    paymentDueDate: '2024-02-27',
    remarks: 'Material dispatched from Bhadrachalam, ETA Jan 30'
  },
  {
    id: '4',
    purchaseInvoiceNumber: 'MILL-INV-2024-004',
    invoiceDate: '2024-01-28',
    mill: 'ITC Paperboards',
    poNumber: 'PO-2024-003',
    paper: 'FBB White Back',
    gsm: 300,
    size: '23x36',
    quantity: 20000,
    baseAmount: 1760000,
    cgst: 0,
    sgst: 0,
    igst: 316800,
    totalAmount: 2076800,
    deliveryMode: 'Direct To Customer',
    directCustomer: 'Raj Printers',
    customerSO: 'SO-2024-001',
    status: 'Punched',
    paymentStatus: 'Pending',
    paymentDueDate: '2024-02-28',
    remarks: 'Direct delivery to Raj Printers, Indore'
  },
  {
    id: '5',
    purchaseInvoiceNumber: 'MILL-INV-2024-005',
    invoiceDate: '2024-01-22',
    mill: 'ITC Paperboards',
    poNumber: 'PO-2024-006',
    paper: 'SBS Board',
    gsm: 320,
    size: '23x36',
    quantity: 14000,
    baseAmount: 1470000,
    cgst: 132300,
    sgst: 132300,
    igst: 0,
    totalAmount: 1734600,
    deliveryMode: 'To Godown',
    grnNumber: 'GRN-2024-006',
    status: 'GRN Done',
    paymentStatus: 'Partially Paid',
    paymentDueDate: '2024-02-22',
    paidAmount: 1000000,
    remarks: 'Partial payment made'
  },
  {
    id: '6',
    purchaseInvoiceNumber: 'MILL-INV-2024-006',
    invoiceDate: '2024-01-25',
    mill: 'Khanna Paper Mills',
    poNumber: 'PO-2024-007',
    paper: 'Duplex Board',
    gsm: 250,
    size: '20x30',
    quantity: 10000,
    baseAmount: 720000,
    cgst: 64800,
    sgst: 64800,
    igst: 0,
    totalAmount: 849600,
    deliveryMode: 'To Godown',
    status: 'Received',
    paymentStatus: 'Pending',
    paymentDueDate: '2024-02-25',
    remarks: 'Material received, GRN pending'
  }
];
export const mockGRNs: GRN[] = [
  {
    id: '1',
    grnNumber: 'GRN-2024-001',
    grnDate: '2024-01-10',
    poNumber: 'PO-MILL-2024-001',
    poId: 'po_1',
    materialId: '1',
    purchaseInvoiceNumber: 'MILL-INV-001',
    millChallanNumber: 'MC-ITC-2024-001',
    mill: 'ITC Paperboards',
    paper: 'FBB White Back',
    gsm: 300,
    size: '23x36',
    orderedQty: 10000,
    previouslyReceivedQty: 0,
    receivedQty: 10000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    receivedWeightMT: 6.21,
    expectedWeightMT: 6.21,
    warehouse: 'Lasudia',
    binLocation: 'Lasudia-A-1-A1',
    suggestedBin: 'Lasudia-A-1-A1',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-FBB-300-23x36-20240110-01',
    lrNumber: 'LR-2024-001',
    transporterName: 'Shree Balaji Transport',
    vehicleNumber: 'MP09AB1234',
    receivedBy: 'Warehouse Team A',
    unloadingStartTime: '2024-01-10 09:00',
    unloadingEndTime: '2024-01-10 10:30',
    status: 'Stock Updated',
    verifiedBy: 'QC Manager',
    verifiedDate: '2024-01-10',
    qcApprovedBy: 'QC Manager',
    millTrackerUpdated: true
  },
  {
    id: '2',
    grnNumber: 'GRN-2024-002',
    grnDate: '2024-01-12',
    poNumber: 'PO-MILL-2024-002',
    poId: 'po_2',
    materialId: '2',
    purchaseInvoiceNumber: 'MILL-INV-002',
    millChallanNumber: 'MC-ITC-2024-002',
    mill: 'ITC Paperboards',
    paper: 'FBB White Back',
    gsm: 250,
    size: '20x30',
    orderedQty: 8000,
    previouslyReceivedQty: 0,
    receivedQty: 8000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Lasudia',
    binLocation: 'Lasudia-A-1-A2',
    suggestedBin: 'Lasudia-A-1-A2',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-FBB-250-20x30-20240112-01',
    lrNumber: 'LR-2024-002',
    transporterName: 'Shree Balaji Transport',
    vehicleNumber: 'MP09CD5678',
    receivedBy: 'Warehouse Team A',
    status: 'Stock Updated',
    verifiedBy: 'QC Manager',
    verifiedDate: '2024-01-12',
    qcApprovedBy: 'QC Manager',
    millTrackerUpdated: true
  },
  {
    id: '3',
    grnNumber: 'GRN-2024-003',
    grnDate: '2024-01-15',
    poNumber: 'PO-MILL-2024-003',
    purchaseInvoiceNumber: 'MILL-INV-003',
    mill: 'ITC Paperboards',
    paper: 'Duplex Board',
    gsm: 250,
    size: '20x30',
    orderedQty: 6000,
    previouslyReceivedQty: 0,
    receivedQty: 6000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Lasudia',
    binLocation: 'Lasudia-A-2-B1',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-DUP-250-20x30-20240115-01',
    lrNumber: 'LR-2024-003',
    transporterName: 'Rathi Roadways',
    vehicleNumber: 'MP09EF9012',
    receivedBy: 'Warehouse Team B',
    status: 'Stock Updated',
    verifiedBy: 'QC Manager',
    verifiedDate: '2024-01-15',
    qcApprovedBy: 'QC Manager',
    millTrackerUpdated: true
  },
  {
    id: '4',
    grnNumber: 'GRN-2024-004',
    grnDate: '2024-01-08',
    poNumber: 'PO-MILL-2024-004',
    poId: 'po_4',
    materialId: '3',
    purchaseInvoiceNumber: 'MILL-INV-004',
    mill: 'ITC Paperboards',
    paper: 'Kraft Paper',
    gsm: 200,
    size: '24x36',
    orderedQty: 7000,
    previouslyReceivedQty: 0,
    receivedQty: 7000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Lasudia',
    binLocation: 'Lasudia-A-2-B2',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-KRA-200-24x36-20240108-01',
    lrNumber: 'LR-2024-004',
    transporterName: 'Rathi Roadways',
    vehicleNumber: 'MP09GH3456',
    receivedBy: 'Warehouse Team A',
    status: 'Stock Updated',
    verifiedBy: 'QC Manager',
    verifiedDate: '2024-01-08',
    qcApprovedBy: 'QC Manager',
    millTrackerUpdated: true
  },
  {
    id: '5',
    grnNumber: 'GRN-2024-005',
    grnDate: '2024-01-20',
    poNumber: 'PO-MILL-2024-005',
    purchaseInvoiceNumber: 'MILL-INV-005',
    mill: 'ITC Paperboards',
    paper: 'FBB Grey Back',
    gsm: 280,
    size: '23x36',
    orderedQty: 12000,
    previouslyReceivedQty: 0,
    receivedQty: 12000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Lasudia',
    binLocation: 'Lasudia-B-1-A1',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-FBB-280-23x36-20240120-01',
    lrNumber: 'LR-2024-005',
    transporterName: 'Shree Balaji Transport',
    vehicleNumber: 'MP09JK7890',
    receivedBy: 'Warehouse Team A',
    status: 'Stock Updated',
    millTrackerUpdated: true
  },
  {
    id: '6',
    grnNumber: 'GRN-2024-006',
    grnDate: '2024-01-22',
    poNumber: 'PO-MILL-2024-006',
    purchaseInvoiceNumber: 'MILL-INV-006',
    mill: 'ITC Paperboards',
    paper: 'SBS Board',
    gsm: 320,
    size: '23x36',
    orderedQty: 14000,
    previouslyReceivedQty: 0,
    receivedQty: 14000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Sanwer',
    binLocation: 'Sanwer-A-1-A1',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-SBS-320-23x36-20240122-01',
    lrNumber: 'LR-2024-006',
    transporterName: 'Naveen Transport',
    vehicleNumber: 'MP09LM2345',
    receivedBy: 'Warehouse Team B',
    status: 'Stock Updated',
    millTrackerUpdated: true
  },
  {
    id: '7',
    grnNumber: 'GRN-2024-007',
    grnDate: '2024-01-25',
    poNumber: 'PO-MILL-2024-007',
    purchaseInvoiceNumber: 'MILL-INV-007',
    mill: 'ITC Paperboards',
    paper: 'FBB White Back',
    gsm: 350,
    size: '23x36',
    orderedQty: 7000,
    previouslyReceivedQty: 0,
    receivedQty: 7000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Sanwer',
    binLocation: 'Sanwer-A-1-A2',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-FBB-350-23x36-20240125-01',
    lrNumber: 'LR-2024-007',
    transporterName: 'Naveen Transport',
    vehicleNumber: 'MP09NP6789',
    receivedBy: 'Warehouse Team A',
    status: 'Stock Updated',
    millTrackerUpdated: true
  },
  {
    id: '8',
    grnNumber: 'GRN-2024-008',
    grnDate: '2024-01-18',
    poNumber: 'PO-MILL-2024-008',
    purchaseInvoiceNumber: 'MILL-INV-008',
    mill: 'ITC Paperboards',
    paper: 'Duplex Board',
    gsm: 300,
    size: '23x36',
    orderedQty: 18000,
    previouslyReceivedQty: 0,
    receivedQty: 18000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Sanwer',
    binLocation: 'Sanwer-A-2-B1',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-DUP-300-23x36-20240118-01',
    lrNumber: 'LR-2024-008',
    transporterName: 'Shree Balaji Transport',
    vehicleNumber: 'MP09QR1234',
    receivedBy: 'Warehouse Team B',
    status: 'Stock Updated',
    millTrackerUpdated: true
  },
  {
    id: '9',
    grnNumber: 'GRN-2024-009',
    grnDate: '2024-01-16',
    poNumber: 'PO-MILL-2024-009',
    purchaseInvoiceNumber: 'MILL-INV-009',
    millChallanNumber: 'MC-ITC-2024-009',
    mill: 'ITC Paperboards',
    paper: 'Kraft Paper',
    gsm: 180,
    size: '22x34',
    orderedQty: 5500,
    previouslyReceivedQty: 0,
    receivedQty: 5000,
    shortQty: 300,
    damagedQty: 200,
    balanceQty: 500,
    warehouse: 'Sanwer',
    binLocation: 'Sanwer-B-1-A1',
    condition: 'Slight Damage',
    qcResult: 'Accepted with Remark',
    qualityGrade: 'B Grade',
    lotNumber: 'ITC-KRA-180-22x34-20240116-01',
    lrNumber: 'LR-2024-009',
    transporterName: 'Rathi Roadways',
    vehicleNumber: 'MP09ST5678',
    receivedBy: 'Warehouse Team A',
    status: 'Approved',
    verifiedBy: 'QC Supervisor',
    verifiedDate: '2024-01-16',
    remarks: 'Minor edge damage on 200 sheets, 300 short from order'
  },
  {
    id: '10',
    grnNumber: 'GRN-2024-010',
    grnDate: '2024-01-28',
    poNumber: 'PO-MILL-2024-010',
    purchaseInvoiceNumber: 'MILL-INV-010',
    mill: 'ITC Paperboards',
    paper: 'FBB White Back',
    gsm: 300,
    size: '23x36',
    orderedQty: 20000,
    previouslyReceivedQty: 0,
    receivedQty: 20000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Pithampur',
    binLocation: 'Pithampur-A-1-A1',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-FBB-300-23x36-20240128-01',
    lrNumber: 'LR-2024-010',
    transporterName: 'Shree Balaji Transport',
    vehicleNumber: 'MP09UV9012',
    receivedBy: 'Warehouse Team A',
    status: 'Stock Updated',
    millTrackerUpdated: true
  },
  {
    id: '11',
    grnNumber: 'GRN-2024-011',
    grnDate: '2024-01-26',
    poNumber: 'PO-MILL-2024-011',
    purchaseInvoiceNumber: 'MILL-INV-011',
    mill: 'ITC Paperboards',
    paper: 'FBB Grey Back',
    gsm: 300,
    size: '23x36',
    orderedQty: 10000,
    previouslyReceivedQty: 0,
    receivedQty: 10000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Pithampur',
    binLocation: 'Pithampur-A-1-A2',
    suggestedBin: 'Pithampur-A-1-A2',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-FBB-300-23x36-20240126-01',
    lrNumber: 'LR-2024-011',
    transporterName: 'Naveen Transport',
    vehicleNumber: 'MP09WX3456',
    receivedBy: 'Warehouse Team B',
    status: 'QC Pending',
    remarks: 'Awaiting quality inspection'
  },
  {
    id: '12',
    grnNumber: 'GRN-2024-012',
    grnDate: '2024-01-29',
    poNumber: 'PO-MILL-2024-012',
    purchaseInvoiceNumber: 'MILL-INV-012',
    millChallanNumber: 'MC-ITC-2024-012',
    mill: 'ITC Paperboards',
    paper: 'Art Paper',
    gsm: 130,
    size: '23x36',
    orderedQty: 15000,
    previouslyReceivedQty: 0,
    receivedQty: 12000,
    shortQty: 3000,
    damagedQty: 0,
    balanceQty: 3000,
    warehouse: 'Lasudia',
    binLocation: '',
    suggestedBin: 'Lasudia-C-1-A1',
    condition: 'Good',
    qcResult: 'Accepted with Remark',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-ART-130-23x36-20240129-01',
    lrNumber: 'LR-2024-012',
    transporterName: 'Express Cargo',
    vehicleNumber: 'MP09YZ7890',
    receivedBy: 'Warehouse Team A',
    status: 'Discrepancy Raised',
    remarks: 'Short supply: 3000 sheets missing from order. Mill to confirm balance dispatch date.'
  },
  {
    id: '13',
    grnNumber: 'GRN-2024-013',
    grnDate: '2024-01-30',
    poNumber: 'PO-MILL-2024-013',
    purchaseInvoiceNumber: '',
    mill: 'ITC Paperboards',
    paper: 'Maplitho',
    gsm: 80,
    size: '23x36',
    orderedQty: 25000,
    previouslyReceivedQty: 10000,
    receivedQty: 15000,
    shortQty: 0,
    damagedQty: 0,
    balanceQty: 0,
    warehouse: 'Lasudia',
    binLocation: '',
    suggestedBin: 'Lasudia-C-2-A1',
    condition: 'Good',
    qcResult: 'Accepted',
    qualityGrade: 'A Grade',
    lotNumber: 'ITC-MAP-80-23x36-20240130-01',
    lrNumber: 'LR-2024-013',
    transporterName: 'Shree Ganesh Transport',
    vehicleNumber: 'MP09AB5678',
    status: 'Draft',
    remarks: 'Second delivery against PO. First 10000 received on 2024-01-15.'
  },
  {
    id: '14',
    grnNumber: 'GRN-2024-014',
    grnDate: '2024-01-31',
    poNumber: 'PO-MILL-2024-014',
    purchaseInvoiceNumber: 'MILL-INV-014',
    mill: 'ITC Paperboards',
    paper: 'FBB White Back',
    gsm: 300,
    size: '25x36',
    orderedQty: 8000,
    previouslyReceivedQty: 0,
    receivedQty: 7500,
    shortQty: 0,
    damagedQty: 500,
    balanceQty: 500,
    warehouse: 'Sanwer',
    binLocation: '',
    suggestedBin: 'Sanwer-B-2-A1',
    condition: 'Wet',
    qcResult: 'Rejected',
    qualityGrade: 'Rejected',
    lotNumber: 'ITC-FBB-300-25x36-20240131-01',
    lrNumber: 'LR-2024-014',
    transporterName: 'National Transport',
    vehicleNumber: 'MP09CD9012',
    receivedBy: 'Warehouse Team B',
    status: 'Discrepancy Raised',
    remarks: '500 sheets wet damaged during transit. QC rejected lot. Debit note to be raised.'
  }
];

// ============================================================================
// DASHBOARD DATA
// ============================================================================

export const mockDashboardStats = {
  todaySales: 285000,
  pendingApprovals: 8,
  overduePayments: 12,
  lowStock: 6,
  activeOrders: 34,
  monthSales: 8450000,
};

export const mockSalesChartData = [
  { month: 'Jan', sales: 4200000, collections: 3800000 },
  { month: 'Feb', sales: 3900000, collections: 4100000 },
  { month: 'Mar', sales: 5100000, collections: 4800000 },
  { month: 'Apr', sales: 4800000, collections: 5200000 },
  { month: 'May', sales: 5600000, collections: 5100000 },
  { month: 'Jun', sales: 6200000, collections: 5800000 },
  { month: 'Jul', sales: 5900000, collections: 6400000 },
  { month: 'Aug', sales: 6800000, collections: 6200000 },
  { month: 'Sep', sales: 7200000, collections: 6900000 },
  { month: 'Oct', sales: 7800000, collections: 7500000 },
  { month: 'Nov', sales: 8100000, collections: 7900000 },
  { month: 'Dec', sales: 8450000, collections: 8200000 },
];

export const mockWeeklySalesData = {
  this_month: [
    { label: 'Week 1', sales: 1800000, collections: 1600000 },
    { label: 'Week 2', sales: 2100000, collections: 1900000 },
    { label: 'Week 3', sales: 2300000, collections: 2200000 },
    { label: 'Week 4', sales: 2250000, collections: 2500000 },
  ],
  last_month: [
    { label: 'Week 1', sales: 1900000, collections: 1800000 },
    { label: 'Week 2', sales: 2200000, collections: 2100000 },
    { label: 'Week 3', sales: 2100000, collections: 2000000 },
    { label: 'Week 4', sales: 1900000, collections: 2000000 },
  ],
};

export const mockMillStockData = [
  { mill: 'Ballarpur', value: 2850000, sheets: 185000 },
  { mill: 'JK Paper', value: 3200000, sheets: 210000 },
  { mill: 'Century', value: 1950000, sheets: 125000 },
  { mill: 'Tamil Nadu', value: 2450000, sheets: 165000 },
  { mill: 'West Coast', value: 1750000, sheets: 115000 },
];

export const mockRecentActivity = [
  {
    id: '1',
    type: 'order' as const,
    message: 'New order SO-2024-045 from ABC Printers',
    time: '5 mins ago',
    user: 'Rajesh Kumar'
  },
  {
    id: '2',
    type: 'payment' as const,
    message: 'Payment received ₹2.5L from XYZ Packaging',
    time: '12 mins ago',
    user: 'Priya Sharma'
  },
  {
    id: '3',
    type: 'stock' as const,
    message: 'GRN-2024-112 verified - 15,000 sheets',
    time: '25 mins ago',
    user: 'Warehouse Team'
  },
  {
    id: '4',
    type: 'approval' as const,
    message: 'Order SO-2024-043 approved by owner',
    time: '1 hour ago',
    user: 'Owner'
  },
  {
    id: '5',
    type: 'order' as const,
    message: 'Challan CH-2024-089 dispatched',
    time: '2 hours ago',
    user: 'Warehouse Team'
  },
];

export const mockSalesInvoices: SalesInvoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    invoiceDate: '2024-01-24',
    soNumber: 'SO-2024-001',
    challanNumber: 'CH-2024-001',
    customer: 'Rajesh Agarwal',
    customerCompany: 'Raj Printers',
    customerGST: '23AABCR1234A1Z5',
    deliveryAddress: 'Industrial Area, Indore',
    lines: [
      { id: 'sil-1', paper: 'FBB White Back', gsm: 300, size: '23x36', quantity: 8000, rate: 110.00, amount: 880000 }
    ],
    baseAmount: 880000,
    cgst: 79200,
    sgst: 79200,
    igst: 0,
    totalAmount: 1038400,
    status: 'Issued',
    paymentStatus: 'Partially Paid',
    paymentDueDate: '2024-02-24',
    paidAmount: 500000,
    tallySync: true,
    tallySyncDate: '2024-01-25',
    tallyVoucherNumber: 'TV-2024-001'
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    invoiceDate: '2024-01-19',
    soNumber: 'SO-2024-005',
    challanNumber: 'CH-2024-002',
    customer: 'Vikram Mehta',
    customerCompany: 'Quick Print Solutions',
    customerGST: '23AABCQ5678B2Z3',
    deliveryAddress: 'AB Road, Indore',
    lines: [
      { id: 'sil-2', paper: 'FBB White Back', gsm: 250, size: '20x30', quantity: 6000, rate: 85.00, amount: 510000 }
    ],
    baseAmount: 510000,
    cgst: 45900,
    sgst: 45900,
    igst: 0,
    totalAmount: 601800,
    status: 'Paid',
    paymentStatus: 'Paid',
    paymentDueDate: '2024-02-19',
    paidAmount: 601800,
    tallySync: true,
    tallySyncDate: '2024-01-20',
    tallyVoucherNumber: 'TV-2024-002'
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    invoiceDate: '2024-01-25',
    soNumber: 'SO-2024-002',
    challanNumber: 'CH-2024-003',
    customer: 'Sunil Patel',
    customerCompany: 'ABC Packaging',
    customerGST: '23AABCA9012C3Z1',
    deliveryAddress: 'MIG Colony, Indore',
    lines: [
      { id: 'sil-3', paper: 'Kraft Paper', gsm: 200, size: '24x36', quantity: 7000, rate: 75.00, amount: 525000 },
      { id: 'sil-4', paper: 'Duplex Board', gsm: 250, size: '20x30', quantity: 5000, rate: 90.00, amount: 450000 }
    ],
    baseAmount: 975000,
    cgst: 87750,
    sgst: 87750,
    igst: 0,
    totalAmount: 1150500,
    status: 'Issued',
    paymentStatus: 'Pending',
    paymentDueDate: '2024-02-25',
    tallySync: true,
    tallySyncDate: '2024-01-26',
    tallyVoucherNumber: 'TV-2024-003'
  },
  {
    id: '4',
    invoiceNumber: 'INV-2024-004',
    invoiceDate: '2024-01-26',
    soNumber: 'SO-2024-004',
    customer: 'Amit Sharma',
    customerCompany: 'Modern Printers',
    customerGST: '23AABCM3456D4Z9',
    deliveryAddress: 'Vijay Nagar, Indore',
    lines: [
      { id: 'sil-5', paper: 'FBB Grey Back', gsm: 280, size: '23x36', quantity: 10000, rate: 95.00, amount: 950000 }
    ],
    baseAmount: 950000,
    cgst: 85500,
    sgst: 85500,
    igst: 0,
    totalAmount: 1121000,
    status: 'Draft',
    paymentStatus: 'Pending',
    paymentDueDate: '2024-02-26',
    tallySync: false,
    remarks: 'Invoice pending - material in transit'
  },
  {
    id: '5',
    invoiceNumber: 'INV-2024-005',
    invoiceDate: '2024-01-28',
    soNumber: 'SO-2024-003',
    customer: 'Priya Joshi',
    customerCompany: 'Supreme Packaging Ltd',
    customerGST: '23AABCS7890E5Z7',
    deliveryAddress: 'Pithampur Industrial Area',
    lines: [
      { id: 'sil-6', paper: 'SBS Board', gsm: 320, size: '23x36', quantity: 12000, rate: 125.00, amount: 1500000 }
    ],
    baseAmount: 1500000,
    cgst: 135000,
    sgst: 135000,
    igst: 0,
    totalAmount: 1770000,
    status: 'Draft',
    paymentStatus: 'Pending',
    paymentDueDate: '2024-02-28',
    tallySync: false,
    remarks: 'Pending mill dispatch'
  }
];
export const mockTallyExports: TallyExport[] = [
  {
    id: '1',
    exportNumber: 'TEXP-2024-001',
    exportDate: '2024-01-25',
    exportType: 'Sales Invoice',
    invoiceNumbers: ['INV-2024-001', 'INV-2024-002'],
    fileName: 'sales_invoices_jan25.xml',
    fileFormat: 'XML',
    exportedBy: 'Admin',
    status: 'Synced',
    syncedAt: '2024-01-25 14:30',
    recordCount: 2
  },
  {
    id: '2',
    exportNumber: 'TEXP-2024-002',
    exportDate: '2024-01-26',
    exportType: 'Purchase Invoice',
    invoiceNumbers: ['MILL-INV-2024-001', 'MILL-INV-2024-002'],
    fileName: 'purchase_invoices_jan26.xml',
    fileFormat: 'XML',
    exportedBy: 'Admin',
    status: 'Synced',
    syncedAt: '2024-01-26 10:15',
    recordCount: 2
  },
  {
    id: '3',
    exportNumber: 'TEXP-2024-003',
    exportDate: '2024-01-27',
    exportType: 'Sales Invoice',
    invoiceNumbers: ['INV-2024-003'],
    fileName: 'sales_invoices_jan27.xml',
    fileFormat: 'XML',
    exportedBy: 'Admin',
    status: 'Sent to Tally',
    recordCount: 1
  },
  {
    id: '4',
    exportNumber: 'TEXP-2024-004',
    exportDate: '2024-01-28',
    exportType: 'Payment Receipt',
    invoiceNumbers: ['REC-2024-001', 'REC-2024-002', 'REC-2024-003'],
    fileName: 'payment_receipts_jan28.csv',
    fileFormat: 'CSV',
    exportedBy: 'Admin',
    status: 'Generated',
    recordCount: 3
  },
  {
    id: '5',
    exportNumber: 'TEXP-2024-005',
    exportDate: '2024-01-20',
    exportType: 'Purchase Invoice',
    invoiceNumbers: ['MILL-INV-2024-005'],
    fileName: 'purchase_invoices_jan20.xml',
    fileFormat: 'XML',
    exportedBy: 'Admin',
    status: 'Error',
    errorMessage: 'Tally connection timeout - retry required',
    recordCount: 1
  }
];
export const mockPaymentReceipts: PaymentReceipt[] = [];
export const mockMillPayments: MillPayment[] = [];

// ============================================================================
// RATE MASTER
// ============================================================================

export interface SalesRate {
  id: string;
  customerId: string;
  customerName?: string;
  materialId: string;
  materialCode?: string;
  rate: number;
  discount?: number;   // ₹/KG discount given to this customer
  unit: 'KG' | 'Sheet';
  effectiveFrom?: string;
  notes?: string;
  status: 'Active' | 'Inactive';
}

export interface PurchaseRate {
  id: string;
  millId: string;
  millName?: string;
  materialId: string;
  materialCode?: string;
  rate: number;
  unit: 'KG' | 'Sheet';
  effectiveFrom?: string;
  notes?: string;
  status: 'Active' | 'Inactive';
}

export const mockSalesRates: SalesRate[] = [
  { id: '1', customerId: '1', customerName: 'Raj Printers Pvt Ltd', materialId: '1', materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet', rate: 110, discount: 5, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '2', customerId: '1', customerName: 'Raj Printers Pvt Ltd', materialId: '2', materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet', rate: 95, discount: 3, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '3', customerId: '1', customerName: 'Raj Printers Pvt Ltd', materialId: '3', materialCode: 'ITC Paperboards/Grey Back/200/24x36/Sheet', rate: 72, discount: 0, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '4', customerId: '2', customerName: 'Raj Printers Pvt Ltd', materialId: '1', materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet', rate: 108, discount: 2, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '5', customerId: '3', customerName: 'Gupta Packaging Ltd', materialId: '1', materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet', rate: 112, discount: 4, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '6', customerId: '3', customerName: 'Gupta Packaging Ltd', materialId: '2', materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet', rate: 97, discount: 2, unit: 'KG', effectiveFrom: '2024-02-01', notes: 'Revised rate', status: 'Active' },
  { id: '7',  customerId: '3', customerName: 'Gupta Packaging Ltd',  materialId: '4', materialCode: 'ITC Paperboards/FBB/350/25x38/Reel', rate: 130, discount: 0, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Inactive' },
  // Indus (id 4)
  { id: '8',  customerId: '4', customerName: 'Indus',               materialId: '1', materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet',        rate: 105, unit: 'KG',    effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '9',  customerId: '4', customerName: 'Indus',               materialId: '2', materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet',  rate:  90, unit: 'KG',    effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '10', customerId: '4', customerName: 'Indus',               materialId: '3', materialCode: 'ITC Paperboards/Grey Back/200/24x36/Sheet',   rate:  68, unit: 'Sheet', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '11', customerId: '4', customerName: 'Indus',               materialId: '4', materialCode: 'ITC Paperboards/FBB/350/25x38/Reel',         rate: 125, unit: 'KG',    effectiveFrom: '2024-01-01', status: 'Active' },
  // Sharma Paper Works (id 5)
  { id: '12', customerId: '5', customerName: 'Sharma Paper Works',  materialId: '1', materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet',        rate: 107, unit: 'KG',    effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '13', customerId: '5', customerName: 'Sharma Paper Works',  materialId: '2', materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet',  rate:  93, unit: 'KG',    effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '14', customerId: '5', customerName: 'Sharma Paper Works',  materialId: '3', materialCode: 'ITC Paperboards/Grey Back/200/24x36/Sheet',   rate:  70, unit: 'Sheet', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '15', customerId: '5', customerName: 'Sharma Paper Works',  materialId: '4', materialCode: 'ITC Paperboards/FBB/350/25x38/Reel',         rate: 128, unit: 'KG',    effectiveFrom: '2024-01-01', status: 'Active' },
  // Mehta Trading Co (id 6)
  { id: '16', customerId: '6', customerName: 'Mehta Trading Co',    materialId: '1', materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet',        rate: 103, unit: 'KG',    effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '17', customerId: '6', customerName: 'Mehta Trading Co',    materialId: '2', materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet',  rate:  88, unit: 'KG',    effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '18', customerId: '6', customerName: 'Mehta Trading Co',    materialId: '3', materialCode: 'ITC Paperboards/Grey Back/200/24x36/Sheet',   rate:  65, unit: 'Sheet', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '19', customerId: '6', customerName: 'Mehta Trading Co',    materialId: '4', materialCode: 'ITC Paperboards/FBB/350/25x38/Reel',         rate: 122, unit: 'KG',    effectiveFrom: '2024-01-01', status: 'Active' },
];

export const mockPurchaseRates: PurchaseRate[] = [
  { id: '1', millId: '1', millName: 'ITC Paperboards', materialId: '1', materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet', rate: 88, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '2', millId: '1', millName: 'ITC Paperboards', materialId: '2', materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet', rate: 75, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '3', millId: '1', millName: 'ITC Paperboards', materialId: '3', materialCode: 'ITC Paperboards/Grey Back/200/24x36/Sheet', rate: 58, unit: 'Sheet', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '4', millId: '1', millName: 'ITC Paperboards', materialId: '4', materialCode: 'ITC Paperboards/FBB/350/25x38/Reel', rate: 105, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '5', millId: '2', millName: 'JK Paper', materialId: '1', materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet', rate: 85, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Active' },
  { id: '6', millId: '2', millName: 'JK Paper', materialId: '2', materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet', rate: 72, unit: 'KG', effectiveFrom: '2024-01-01', notes: 'Negotiated rate', status: 'Active' },
  { id: '7', millId: '3', millName: 'Seshasayee Paper', materialId: '1', materialCode: 'ITC Paperboards/FBB/300/23x36/Sheet', rate: 91, unit: 'KG', effectiveFrom: '2024-02-01', status: 'Active' },
  { id: '8', millId: '3', millName: 'Seshasayee Paper', materialId: '2', materialCode: 'ITC Paperboards/White Back/250/22x36/Sheet', rate: 78, unit: 'KG', effectiveFrom: '2024-01-01', status: 'Inactive' },
];

// ── Unified Rate Master ────────────────────────────────────────────────────────
// category:
//   'Direct'      = Sales: Monit–Customer direct fixed rate (no mill factor)
//   'Mill-Wise'   = Sales: Mill-specific rate for a customer
//   'Standard'    = Purchase: Mill standard rate charged to Monit (stock group basis)
//   'Client-Wise' = Purchase: Mill charges different rate for a specific client
export interface Rate {
  id: string;
  type: 'Sales' | 'Purchase';
  category: 'Direct' | 'Mill-Wise' | 'Standard' | 'Client-Wise';
  customerId?: string;
  customerName?: string;
  millId?: string;
  millName?: string;
  stockGroupId: string;
  stockGroupName?: string;
  stockCategoryId?: string;   // GSM (Stock Category)
  stockCategoryLabel?: string; // e.g. "250 GSM"
  itemType: 'Reel' | 'Sheet';
  rate: number;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
  status: 'Active' | 'Inactive';
}

export const mockRates: Rate[] = [
  // Sales – Direct (Monit fixed with customer, no mill dependency)
  { id: 'r1',  type: 'Sales',    category: 'Direct',      customerId: '1', customerName: 'Raj Printers Pvt Ltd',  stockGroupId: 'sg3', stockGroupName: 'FBB',       itemType: 'Sheet', rate: 110, effectiveFrom: '2024-01-01', status: 'Active'   },
  { id: 'r2',  type: 'Sales',    category: 'Direct',      customerId: '1', customerName: 'Raj Printers Pvt Ltd',  stockGroupId: 'sg2', stockGroupName: 'White Back', itemType: 'Sheet', rate: 95,  effectiveFrom: '2024-01-01', status: 'Active'   },
  { id: 'r3',  type: 'Sales',    category: 'Direct',      customerId: '3', customerName: 'Gupta Packaging Ltd',   stockGroupId: 'sg3', stockGroupName: 'FBB',       itemType: 'Sheet', rate: 112, effectiveFrom: '2024-01-01', status: 'Active'   },
  { id: 'r13', type: 'Sales',    category: 'Direct',      customerId: '1', customerName: 'Raj Printers Pvt Ltd',  stockGroupId: 'sg3', stockGroupName: 'FBB',       itemType: 'Sheet', rate: 105, effectiveFrom: '2023-06-01', effectiveTo: '2023-12-31', status: 'Inactive' },
  // Sales – Mill-Wise (rate depends on which mill supplies)
  { id: 'r4',  type: 'Sales',    category: 'Mill-Wise',   customerId: '1', customerName: 'Raj Printers Pvt Ltd',  millId: 'm1', millName: 'ITC Paperboards', stockGroupId: 'sg3', stockGroupName: 'FBB',       itemType: 'Sheet', rate: 108, effectiveFrom: '2024-01-01', status: 'Active' },
  { id: 'r5',  type: 'Sales',    category: 'Mill-Wise',   customerId: '3', customerName: 'Gupta Packaging Ltd',   millId: 'm2', millName: 'JK Paper',        stockGroupId: 'sg1', stockGroupName: 'Grey Back', itemType: 'Sheet', rate: 97,  effectiveFrom: '2024-02-01', status: 'Active' },
  { id: 'r6',  type: 'Sales',    category: 'Mill-Wise',   customerId: '3', customerName: 'Gupta Packaging Ltd',   millId: 'm2', millName: 'JK Paper',        stockGroupId: 'sg1', stockGroupName: 'Grey Back', itemType: 'Reel',  rate: 130, effectiveFrom: '2024-01-01', status: 'Inactive' },
  // Purchase – Standard (mill charges Monit, stock-group basis)
  { id: 'r7',  type: 'Purchase', category: 'Standard',    millId: 'm1', millName: 'ITC Paperboards', stockGroupId: 'sg3', stockGroupName: 'FBB',       itemType: 'Sheet', rate: 88,  effectiveFrom: '2024-01-01', status: 'Active' },
  { id: 'r8',  type: 'Purchase', category: 'Standard',    millId: 'm1', millName: 'ITC Paperboards', stockGroupId: 'sg2', stockGroupName: 'White Back', itemType: 'Sheet', rate: 75,  effectiveFrom: '2024-01-01', status: 'Active' },
  { id: 'r9',  type: 'Purchase', category: 'Standard',    millId: 'm2', millName: 'JK Paper',        stockGroupId: 'sg1', stockGroupName: 'Grey Back', itemType: 'Sheet', rate: 70,  effectiveFrom: '2024-01-01', status: 'Active' },
  { id: 'r10', type: 'Purchase', category: 'Standard',    millId: 'm1', millName: 'ITC Paperboards', stockGroupId: 'sg3', stockGroupName: 'FBB',       itemType: 'Sheet', rate: 82,  effectiveFrom: '2023-06-01', effectiveTo: '2023-12-31', status: 'Inactive' },
  // Purchase – Client-Wise (mill charges different rate for specific client)
  { id: 'r11', type: 'Purchase', category: 'Client-Wise', millId: 'm1', millName: 'ITC Paperboards', customerId: '1', customerName: 'Raj Printers Pvt Ltd', stockGroupId: 'sg3', stockGroupName: 'FBB',       itemType: 'Sheet', rate: 85, effectiveFrom: '2024-01-01', status: 'Active' },
  { id: 'r12', type: 'Purchase', category: 'Client-Wise', millId: 'm2', millName: 'JK Paper',        customerId: '3', customerName: 'Gupta Packaging Ltd',  stockGroupId: 'sg1', stockGroupName: 'Grey Back', itemType: 'Sheet', rate: 68, effectiveFrom: '2024-01-01', status: 'Active' },
];

// ============================================================================
// MOCK USERS (for frontend auth simulation)
// ============================================================================

export type UserRole = 'Admin' | 'Manager' | 'Salesman' | 'Accountant' | 'Planner' | 'Warehouse Manager' | 'Customer';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  password: string; // plain text — mock only, never do this in production
  role: UserRole;
  customerId?: string;  // only for Customer role — links to Customer record
  customerName?: string;
  avatar?: string; // initials fallback
}

export const mockUsers: MockUser[] = [
  {
    id: 'u1',
    name: 'Arun Monit',
    email: 'admin@monit.com',
    password: 'admin123',
    role: 'Admin',
  },
  {
    id: 'u2',
    name: 'Ramesh Kumar',
    email: 'ramesh@monit.com',
    password: 'sales123',
    role: 'Salesman',
  },
  {
    id: 'u3',
    name: 'Priya Shah',
    email: 'priya@monit.com',
    password: 'accounts123',
    role: 'Accountant',
  },
  {
    id: 'u4',
    name: 'Raj Kumar',
    email: 'raj@rajprinters.com',
    password: 'customer123',
    role: 'Customer',
    customerId: '1',
    customerName: 'Raj Printers Pvt Ltd',
  },
  {
    id: 'u5',
    name: 'Anil Gupta',
    email: 'anil@guptapkg.com',
    password: 'customer123',
    role: 'Customer',
    customerId: '3',
    customerName: 'Gupta Packaging Ltd',
  },
  {
    id: 'u6',
    name: 'Vijay Singh',
    email: 'vijay@monit.com',
    password: 'planner123',
    role: 'Planner',
  },
];
