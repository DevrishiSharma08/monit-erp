import { apiFetch, apiDownload } from "./api";

// ── Shared ────────────────────────────────────────────────────────────────────

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

function qs(p: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? "?" + parts.join("&") : "";
}

const LIST_SIZE = 200;

// ── Units ─────────────────────────────────────────────────────────────────────

export interface UnitRow {
  id: number; name: string; description?: string;
  isActive: boolean; createdAt: string;
}
export interface UnitDropdown { id: number; name: string; }

const UN_BASE = "/api/v1/masters/units";
export const unitApi = {
  list:     (search = "") => apiFetch<Paged<UnitRow>>(UN_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  create:   (dto: { name: string; description?: string }) =>
              apiFetch<UnitRow>(UN_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:   (id: number, dto: { name: string; description?: string; isActive: boolean }) =>
              apiFetch<UnitRow>(`${UN_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:   (id: number) => apiFetch<void>(`${UN_BASE}/${id}`, { method: "DELETE" }),
  dropdown: () => apiFetch<UnitDropdown[]>(`${UN_BASE}/dropdown`),
};

// ── Stock Groups (Quality Master) ─────────────────────────────────────────────

export interface SubgroupItem       { id: number; name: string; alias?: string; }
export interface StockGroupRow {
  id: number; name: string; description?: string;
  subgroups: SubgroupItem[];
  isActive: boolean; createdAt: string;
}
export interface StockGroupDropdown { id: number; name: string; }
export interface SubGroupDropdown   { id: number; groupId: number; groupName: string; name: string; alias?: string; }

const SG_BASE = "/api/v1/masters/stock-groups";
export const stockGroupApi = {
  list:      (search = "") => apiFetch<Paged<StockGroupRow>>(SG_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  create:    (dto: { name: string; description?: string; subgroups: { name: string; alias?: string }[] }) =>
               apiFetch<StockGroupRow>(SG_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:    (id: number, dto: { name: string; description?: string; subgroups: { name: string; alias?: string }[]; isActive: boolean }) =>
               apiFetch<StockGroupRow>(`${SG_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:    (id: number) => apiFetch<void>(`${SG_BASE}/${id}`, { method: "DELETE" }),
  dropdown:  () => apiFetch<StockGroupDropdown[]>(`${SG_BASE}/dropdown`),
  subgroups: () => apiFetch<SubGroupDropdown[]>(`${SG_BASE}/subgroups`),
};

// ── Stock Categories ──────────────────────────────────────────────────────────

export interface StockCategoryRow {
  id: number; code: string; name: string;
  stockGroupId?: number; stockGroupName?: string;
  gsmType: string; gsm?: number; gsmMin?: number; gsmMax?: number;
  isActive: boolean; createdAt: string;
}

const SC_BASE = "/api/v1/masters/stock-categories";
export const stockCategoryApi = {
  list:        (search = "") => apiFetch<Paged<StockCategoryRow>>(SC_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  create:      (dto: { gsmType: string; gsm?: number; gsmMin?: number; gsmMax?: number }) =>
                 apiFetch<StockCategoryRow>(SC_BASE, { method: "POST", body: JSON.stringify(dto) }),
  bulkCreate:  (items: Array<{ gsmType: string; gsm?: number; gsmMin?: number; gsmMax?: number }>) =>
                 apiFetch<StockCategoryRow[]>(`${SC_BASE}/bulk`, { method: "POST", body: JSON.stringify({ items }) }),
  update:      (id: number, dto: { gsmType: string; gsm?: number; gsmMin?: number; gsmMax?: number; isActive: boolean }) =>
                 apiFetch<StockCategoryRow>(`${SC_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:      (id: number) => apiFetch<void>(`${SC_BASE}/${id}`, { method: "DELETE" }),
};

// ── Item Types ────────────────────────────────────────────────────────────────

export interface ItemTypeRow {
  id: number; name: string; description?: string;
  isActive: boolean; createdAt: string;
}

const IT_BASE = "/api/v1/masters/item-types";
export const itemTypeApi = {
  list:   (search = "") => apiFetch<Paged<ItemTypeRow>>(IT_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  create: (dto: { name: string; description?: string }) =>
            apiFetch<ItemTypeRow>(IT_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update: (id: number, dto: { name: string; description?: string; isActive: boolean }) =>
            apiFetch<ItemTypeRow>(`${IT_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove: (id: number) => apiFetch<void>(`${IT_BASE}/${id}`, { method: "DELETE" }),
};

// ── Paper Sizes ───────────────────────────────────────────────────────────────

export interface PaperSizeRow {
  id: number; name: string; width?: number; height?: number;
  description?: string; category: string;
  isActive: boolean; createdAt: string;
}

const PZ_BASE = "/api/v1/masters/paper-sizes";
export const paperSizeApi = {
  list:   (search = "") => apiFetch<Paged<PaperSizeRow>>(PZ_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  create: (dto: { name: string; width?: number; height?: number; description?: string; category: string }) =>
            apiFetch<PaperSizeRow>(PZ_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update: (id: number, dto: { name: string; width?: number; height?: number; description?: string; category: string; isActive: boolean }) =>
            apiFetch<PaperSizeRow>(`${PZ_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove: (id: number) => apiFetch<void>(`${PZ_BASE}/${id}`, { method: "DELETE" }),
};

// ── Mills ─────────────────────────────────────────────────────────────────────

export interface MillContactDto {
  id?: number; contactPerson: string; designation?: string; phone?: string; email?: string;
  isDefault?: boolean;
}
export interface MillUnitDto {
  id?: number; unitName: string; address?: string; isDefault?: boolean; contacts: MillContactDto[];
}
export interface MillRow {
  id: number; code: string; name: string;
  ownerName?: string; phone?: string; email?: string;
  gstNo?: string; paymentTerms?: string;
  unitCount: number;
  isActive: boolean; createdAt: string;
}
export interface MillDetailRow extends MillRow {
  units: MillUnitDto[];
}
export interface MillDropdown { id: number; code: string; name: string; paymentTerms?: string; }

export interface MillContactRow { id?: number; contactPerson: string; designation?: string; phone?: string; email?: string; isDefault?: boolean; }

const ML_BASE = "/api/v1/masters/mills";
export const millApi = {
  list:        (search = "") => apiFetch<Paged<MillRow>>(ML_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  getById:     (id: number) => apiFetch<MillDetailRow>(`${ML_BASE}/${id}`),
  create:      (dto: { code: string; name: string; ownerName?: string; phone?: string; email?: string; gstNo?: string; paymentTerms?: string; units: MillUnitDto[] }) =>
                 apiFetch<MillDetailRow>(ML_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:      (id: number, dto: { code: string; name: string; ownerName?: string; phone?: string; email?: string; gstNo?: string; paymentTerms?: string; units: MillUnitDto[]; isActive: boolean }) =>
                 apiFetch<MillDetailRow>(`${ML_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:      (id: number) => apiFetch<void>(`${ML_BASE}/${id}`, { method: "DELETE" }),
  dropdown:    () => apiFetch<MillDropdown[]>(`${ML_BASE}/dropdown`),
  getContacts: (id: number) => apiFetch<MillContactRow[]>(`${ML_BASE}/${id}/contacts`),
};

// ── Salesmen ──────────────────────────────────────────────────────────────────

export interface SalesmanRow {
  id: number; name: string; phone?: string;
  territory?: string; monthlyTarget?: number; isActive: boolean; createdAt: string;
}

export interface SalesmanForSODto { id: number; name: string; }

const SL_BASE = "/api/v1/masters/salesmen";
export const salesmanApi = {
  list:   (search = "") => apiFetch<Paged<SalesmanRow>>(SL_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  forSO:  () => apiFetch<SalesmanForSODto[]>(`${SL_BASE}/for-so`),
  create: (dto: { name: string; phone?: string; email?: string; territory?: string; monthlyTarget?: number }) =>
            apiFetch<SalesmanRow>(SL_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update: (id: number, dto: { name: string; phone?: string; email?: string; territory?: string; monthlyTarget?: number; isActive: boolean }) =>
            apiFetch<SalesmanRow>(`${SL_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove: (id: number) => apiFetch<void>(`${SL_BASE}/${id}`, { method: "DELETE" }),
};

// ── Warehouses ────────────────────────────────────────────────────────────────

export interface WarehouseRackDto    { id?: number; name: string; stackCount: number; isActive: boolean; }
export interface WarehouseBinDto     { id?: number; name: string; isActive: boolean; racks: WarehouseRackDto[]; }
export interface WarehouseRow        { id: number; unit: string; name: string; binCount: number; rackCount: number; isActive: boolean; createdAt: string; }
export interface WarehouseDetailRow  extends WarehouseRow { bins: WarehouseBinDto[]; updatedAt?: string; }
export interface WarehouseDropdown   { id: number; unit: string; name: string; }

const WH_BASE = "/api/v1/masters/warehouses";
export const warehouseApi = {
  list:     (search = "") => apiFetch<Paged<WarehouseRow>>(WH_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  getById:  (id: number)  => apiFetch<WarehouseDetailRow>(`${WH_BASE}/${id}`),
  create:   (dto: { unit: string; name: string; bins: WarehouseBinDto[] }) =>
              apiFetch<WarehouseDetailRow>(WH_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:   (id: number, dto: { unit: string; name: string; bins: WarehouseBinDto[]; isActive: boolean }) =>
              apiFetch<WarehouseDetailRow>(`${WH_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:   (id: number) => apiFetch<void>(`${WH_BASE}/${id}`, { method: "DELETE" }),
  dropdown: () => apiFetch<WarehouseDropdown[]>(`${WH_BASE}/dropdown`),
};

// ── Transporters ──────────────────────────────────────────────────────────────

export interface TransporterVehicleDto { id?: number; vehicleType: string; capacity?: number; capacityUnit?: string; freightRate?: number; }
export interface TransporterRow        { id: number; name: string; phone?: string; email?: string; gstNo?: string; vehicleCount: number; isActive: boolean; createdAt: string; }
export interface TransporterDetailRow  extends TransporterRow { address?: string; panNo?: string; tdsPercent?: number; vehicles: TransporterVehicleDto[]; updatedAt?: string; }
export interface TransporterDropdown   { id: number; name: string; }

type TransporterBaseDto = { name: string; phone?: string; email?: string; address?: string; gstNo?: string; panNo?: string; tdsPercent?: number; vehicles: TransporterVehicleDto[]; };

const TP_BASE = "/api/v1/masters/transporters";
export const transporterApi = {
  list:     (search = "") => apiFetch<Paged<TransporterRow>>(TP_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  getById:  (id: number)  => apiFetch<TransporterDetailRow>(`${TP_BASE}/${id}`),
  create:   (dto: TransporterBaseDto) =>
              apiFetch<TransporterDetailRow>(TP_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:   (id: number, dto: TransporterBaseDto & { isActive: boolean }) =>
              apiFetch<TransporterDetailRow>(`${TP_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:   (id: number) => apiFetch<void>(`${TP_BASE}/${id}`, { method: "DELETE" }),
  dropdown: () => apiFetch<TransporterDropdown[]>(`${TP_BASE}/dropdown`),
};

// ── Customers ─────────────────────────────────────────────────────────────────

export interface CustomerContactDto          { id?: number; name: string; designation?: string; phone?: string; email?: string; isDefault?: boolean; }
export interface CustomerDeliveryLocationDto { id?: number; label?: string; address: string; isDefault: boolean; }
export interface CustomerRow                 { id: number; name: string; ownerName?: string; phone?: string; email?: string; gstNo?: string; creditLimit: number; creditDays: number; paymentTerms?: string; localityId?: number; locality?: string; isActive: boolean; createdAt: string; }
export interface CustomerDetailRow           extends CustomerRow { billingAddress?: string; contacts: CustomerContactDto[]; deliveryLocations: CustomerDeliveryLocationDto[]; updatedAt?: string; }
export interface CustomerDropdown            { id: number; name: string; }

const CU_BASE = "/api/v1/masters/customers";
export const customerApi = {
  list:        (search = "") => apiFetch<Paged<CustomerRow>>(CU_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  getById:     (id: number)  => apiFetch<CustomerDetailRow>(`${CU_BASE}/${id}`),
  create:      (dto: { name: string; ownerName?: string; phone?: string; email?: string; gstNo?: string; billingAddress?: string; creditLimit: number; creditDays: number; paymentTerms?: string; localityId?: number; contacts: CustomerContactDto[]; deliveryLocations: CustomerDeliveryLocationDto[] }) =>
                 apiFetch<CustomerDetailRow>(CU_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:      (id: number, dto: { name: string; ownerName?: string; phone?: string; email?: string; gstNo?: string; billingAddress?: string; creditLimit: number; creditDays: number; paymentTerms?: string; localityId?: number; contacts: CustomerContactDto[]; deliveryLocations: CustomerDeliveryLocationDto[]; isActive: boolean }) =>
                 apiFetch<CustomerDetailRow>(`${CU_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:      (id: number) => apiFetch<void>(`${CU_BASE}/${id}`, { method: "DELETE" }),
  dropdown:    () => apiFetch<CustomerDropdown[]>(`${CU_BASE}/dropdown`),
  forSO:       () => apiFetch<CustomerSODropdown[]>(`${CU_BASE}/for-so`),
  getContacts: (id: number) => apiFetch<CustomerContactDto[]>(`${CU_BASE}/${id}/contacts`),
};

export interface CustomerContactSODto          { id: number; name: string; designation?: string; phone?: string; email?: string; isDefault?: boolean; }
export interface CustomerDeliveryAddressSODto  { id: number; label?: string; address: string; isDefault: boolean; }
export interface CustomerSODropdown {
  id: number; company: string; gstNo?: string;
  creditDays: number; creditLimit: number;
  phone?: string; email?: string;
  billingAddress?: string;
  paymentTerms?: string;
  contacts: CustomerContactSODto[];
  deliveryAddresses: CustomerDeliveryAddressSODto[];
}

// ── Rates ─────────────────────────────────────────────────────────────────────

export interface RateRow {
  id: number;
  // Item identification (merged from MQG)
  millId: number; millCode: string; millName: string;
  qualityId: number; qualityName: string; qualityGroup?: string;
  gsmMin: number; gsmMax: number;
  type: string;                 // "Reel" | "Sheet"
  brandName?: string;
  // Legacy MQG fields (kept for backward compat during backend migration)
  mqgId?: number; mqgCode?: string; mqgLabel?: string;
  // Rate fields
  rateType: string;             // "Sale" | "Purchase"
  rateCategory?: string;        // undefined for Sale | "Self" | "Customer"
  customerId?: number; customerName?: string;
  amount: number;
  discount?: number;            // ₹/KG discount
  effectiveFrom: string;
  isActive: boolean; createdAt: string;
}

export interface RateHistoryRow {
  id: number; amount: number; discount?: number; effectiveFrom: string; createdAt: string; createdBy: string;
}

const RT_BASE = "/api/v1/masters/rates";

interface RateSaleDto {
  millId: number; qualityId: number; gsmMin: number; gsmMax: number; type: string;
  customerIds?: number[]; amount: number; discount?: number; effectiveFrom: string;
}
interface RatePurchaseDto extends RateSaleDto {
  rateCategory: string;
}

export const rateApi = {
  list: (p: { rateType?: string; millId?: number; qualityId?: number; customerId?: number; rateCategory?: string; search?: string } = {}) =>
          apiFetch<Paged<RateRow>>(RT_BASE + qs({ ...p, page: 1, pageSize: LIST_SIZE })),
  createSale:     (dto: RateSaleDto)     => apiFetch<RateRow[]>(`${RT_BASE}/sale`,     { method: "POST", body: JSON.stringify(dto) }),
  createPurchase: (dto: RatePurchaseDto) => apiFetch<RateRow[]>(`${RT_BASE}/purchase`, { method: "POST", body: JSON.stringify(dto) }),
  remove:  (id: number) => apiFetch<void>(`${RT_BASE}/${id}`, { method: "DELETE" }),
  history: (rateId: number) =>
             apiFetch<RateHistoryRow[]>(`${RT_BASE}/${rateId}/history`),
  forCustomer: (customerId: number) =>
                 apiFetch<SORateDto[]>(`${RT_BASE}/for-customer/${customerId}`),
};

export interface SORateDto { materialId: number; rate: number; discount: number; }

// ── HSN Codes ─────────────────────────────────────────────────────────────────
// cgst = gst/2  (intra-state central component)
// sgst = gst/2  (intra-state state component)
// igst = gst    (inter-state — full integrated tax)

export interface HsnCodeRow {
  id: number; code: string; description?: string;
  gstPercent: number;
  cgstPercent: number;   // = gstPercent / 2
  sgstPercent: number;   // = gstPercent / 2
  igstPercent: number;   // = gstPercent (inter-state)
  isActive: boolean; createdAt: string;
}
export interface HsnCodeDropdown {
  id: number; code: string; description?: string;
  gstPercent: number; cgstPercent: number; sgstPercent: number; igstPercent: number;
}

const HSN_BASE = "/api/v1/masters/hsn-codes";
export const hsnCodeApi = {
  list:     (search = "") => apiFetch<Paged<HsnCodeRow>>(HSN_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  getById:  (id: number)  => apiFetch<HsnCodeRow>(`${HSN_BASE}/${id}`),
  create:   (dto: { code: string; description?: string; gstPercent: number }) =>
              apiFetch<HsnCodeRow>(HSN_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:   (id: number, dto: { code: string; description?: string; gstPercent: number; isActive: boolean }) =>
              apiFetch<HsnCodeRow>(`${HSN_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:   (id: number) => apiFetch<void>(`${HSN_BASE}/${id}`, { method: "DELETE" }),
  dropdown: () => apiFetch<HsnCodeDropdown[]>(`${HSN_BASE}/dropdown`),
};

// ── Instructions ───────────────────────────────────────────────────────────────

export interface InstructionRow {
  id: number;
  title?: string;
  applicableTo: "All" | "Specific";
  millIds: number[];
  lines: string[];
  isActive: boolean;
  createdAt: string;
}
export interface InstructionDropdown { id: number; title?: string; applicableTo: "All" | "Specific"; millIds: number[]; lines: string[]; }

const INSTR_BASE = "/api/v1/masters/instructions";
export const instructionApi = {
  list:   (search = "") => apiFetch<Paged<InstructionRow>>(INSTR_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  create: (dto: { title?: string; applicableTo: "All" | "Specific"; millIds: number[]; lines: string[] }) =>
            apiFetch<InstructionRow>(INSTR_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update: (id: number, dto: { title?: string; applicableTo: "All" | "Specific"; millIds: number[]; lines: string[]; isActive: boolean }) =>
            apiFetch<InstructionRow>(`${INSTR_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove: (id: number) => apiFetch<void>(`${INSTR_BASE}/${id}`, { method: "DELETE" }),
  byMill: (millId?: number) => apiFetch<InstructionDropdown[]>(INSTR_BASE + "/by-mill" + qs({ millId })),
};

// ── Localities ────────────────────────────────────────────────────────────────

export interface LocalityRow {
  id: number;
  name: string;
  city?: string;
  state?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}
export interface LocalityDropdown { id: number; name: string; city?: string; }

const LCL_BASE = "/api/v1/masters/localities";
export const localityApi = {
  list:     (search = "") => apiFetch<Paged<LocalityRow>>(LCL_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  create:   (dto: { name: string; city?: string; state?: string; description?: string }) =>
              apiFetch<LocalityRow>(LCL_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:   (id: number, dto: { name: string; city?: string; state?: string; description?: string; isActive: boolean }) =>
              apiFetch<LocalityRow>(`${LCL_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:   (id: number) => apiFetch<void>(`${LCL_BASE}/${id}`, { method: "DELETE" }),
  dropdown: () => apiFetch<LocalityDropdown[]>(`${LCL_BASE}/dropdown`),
};

// ── Company Configuration ─────────────────────────────────────────────────────

export interface CompanyConfigData {
  id:                 number;
  companyName?:       string;
  address?:           string;
  gstNumber?:         string;
  insurancePolicyNo?: string;
  insurancePolicyFy?: string;
  insuranceIssuer?:   string;
  smtpSenderEmail?:   string;
  smtpSenderName?:    string;
  smtpConfigured?:    boolean;
  updatedAt?:         string;
  updatedBy?:         string;
}

export interface SendMailRequest {
  to:      string[];
  cc:      string[];
  subject: string;
  body:    string;
}

export interface SendMailResponse {
  success:     boolean;
  emailSentAt: string;
}

const CC_BASE = "/api/v1/company-config";
export const companyConfigApi = {
  getAll:    () => apiFetch<CompanyConfigData[]>(CC_BASE),
  getById:   (id: number) => apiFetch<CompanyConfigData>(`${CC_BASE}/${id}`),
  update: (id: number, dto: {
    companyName?:       string;
    address?:           string;
    gstNumber?:         string;
    insurancePolicyNo?: string;
    insurancePolicyFy?: string;
    insuranceIssuer?:   string;
    smtpSenderEmail?:   string;
    smtpSenderName?:    string;
    smtpAppPassword?:   string | null;
  }) => apiFetch<CompanyConfigData>(`${CC_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
};

// ── Items (Materials) ─────────────────────────────────────────────────────────

export interface MaterialRow {
  id: number; code: string;
  millId: number; millCode: string; millName: string;
  qualityId: number; qualityName: string;
  itemTypeId: number; itemTypeName: string;
  gsm: number;
  sizeLength: number; sizeWidth?: number; sizeLabel: string;
  grain?: string;
  packingType: string;
  sheetsPerPacket?: number; packetsPerBundle?: number; bundlesPerBox?: number;
  brandName?: string;
  hsnCodeId?: number; hsnCode?: string; gstPercent?: number;
  description?: string; isActive: boolean; createdAt: string;
}

export interface MaterialDropdown {
  id: number; code: string;
  millId: number; millName: string;
  qualityId: number; qualityName: string; itemTypeName: string;
  gsm: number; sizeLength: number; sizeWidth?: number; sizeLabel: string;
  packingType: string;
  sheetsPerPacket?: number; packetsPerBundle?: number; bundlesPerBox?: number;
  brandName?: string;
  hsnCodeId?: number; hsnCode?: string; gstPercent?: number; grain?: string;
  weightPerSheet?: number;
}

const MAT_BASE = "/api/v1/masters/materials";
export const materialApi = {
  list:     (p: { search?: string; millId?: number; qualityId?: number; itemTypeId?: number; gsm?: number; packingType?: string } = {}) =>
              apiFetch<Paged<MaterialRow>>(MAT_BASE + qs({ ...p, page: 1, pageSize: LIST_SIZE })),
  getById:  (id: number) => apiFetch<MaterialRow>(`${MAT_BASE}/${id}`),
  create:   (dto: Record<string, unknown>) =>
              apiFetch<MaterialRow>(MAT_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:   (id: number, dto: Record<string, unknown>) =>
              apiFetch<MaterialRow>(`${MAT_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:   (id: number) => apiFetch<void>(`${MAT_BASE}/${id}`, { method: "DELETE" }),
  dropdown: (millId?: number, qualityId?: number) =>
              apiFetch<MaterialDropdown[]>(MAT_BASE + "/dropdown" + qs({ millId, qualityId })),
};

// ── MQG (Mill-Quality-GSM) ────────────────────────────────────────────────────

export interface MQGRow {
  id: number; code: string;
  millId: number; millCode: string; millName: string;
  qualityId: number; qualityGroup: string; qualityName: string;
  gsmMin: number; gsmMax: number;
  type: string;
  isActive: boolean; createdAt: string;
}
export interface MQGDropdown {
  id: number; code: string; label: string;
  millId: number; qualityId: number;
  gsmMin: number; gsmMax: number; type: string;
}

const MQG_BASE = "/api/v1/masters/mqg";
export const mqgApi = {
  list:     (search = "") => apiFetch<Paged<MQGRow>>(MQG_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  getById:  (id: number)  => apiFetch<MQGRow>(`${MQG_BASE}/${id}`),
  create:   (dto: { millId: number; qualityId: number; gsmMin: number; gsmMax: number; type: string }) =>
              apiFetch<MQGRow>(MQG_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:   (id: number, dto: { millId: number; qualityId: number; gsmMin: number; gsmMax: number; type: string; isActive: boolean }) =>
              apiFetch<MQGRow>(`${MQG_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:   (id: number) => apiFetch<void>(`${MQG_BASE}/${id}`, { method: "DELETE" }),
  dropdown: () => apiFetch<MQGDropdown[]>(`${MQG_BASE}/dropdown`),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserRow {
  id: number; username: string; name: string; email?: string;
  roleId: number; role: string; isActive: boolean; bothCompaniesAccess: boolean;
  lastLoginAt?: string; createdAt: string;
}

const USR_BASE = "/api/v1/users";
export const userApi = {
  list:          (search = "") => apiFetch<Paged<UserRow>>(USR_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  create:        (dto: { username: string; password: string; name: string; email?: string; roleId: number; bothCompaniesAccess?: boolean }) =>
                   apiFetch<UserRow>(USR_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:        (id: number, dto: { name: string; email?: string; roleId: number; isActive: boolean; bothCompaniesAccess?: boolean }) =>
                   apiFetch<UserRow>(`${USR_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:        (id: number) => apiFetch<void>(`${USR_BASE}/${id}`, { method: "DELETE" }),
  resetPassword: (id: number, newPassword: string) =>
                   apiFetch<void>(`${USR_BASE}/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),
};

// ── Roles ─────────────────────────────────────────────────────────────────────

export interface RoleListRow {
  id: number; name: string; description?: string;
  userCount: number; isActive: boolean; createdAt: string;
}
export interface RoleDetailRow extends RoleListRow {
  permissions: string[];
}
export interface PermissionGroup { group: string; permissions: string[]; }
export interface RoleDropdown { id: number; name: string; }

const RL_BASE = "/api/v1/roles";
export const roleApi = {
  list:        (search = "") => apiFetch<Paged<RoleListRow>>(RL_BASE + qs({ search, page: 1, pageSize: LIST_SIZE })),
  getById:     (id: number) => apiFetch<RoleDetailRow>(`${RL_BASE}/${id}`),
  create:      (dto: { name: string; description?: string; permissions: string[] }) =>
                 apiFetch<RoleListRow>(RL_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:      (id: number, dto: { name: string; description?: string; permissions: string[]; isActive: boolean }) =>
                 apiFetch<RoleListRow>(`${RL_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  remove:      (id: number) => apiFetch<void>(`${RL_BASE}/${id}`, { method: "DELETE" }),
  dropdown:    () => apiFetch<RoleDropdown[]>(`${RL_BASE}/dropdown`),
  permissions: () => apiFetch<PermissionGroup[]>(`${RL_BASE}/permissions`),
};

// ── Sales Orders ──────────────────────────────────────────────────────────────

export interface SalesOrderLineDto {
  id: number; lineNumber: number;
  materialId: number; materialCode: string;
  gsm?: number; size?: string; unit?: string;
  orderedQty: number; weightKg?: number; qty?: number;
  rate: number; discount: number; finalPrice?: number; amount: number;
  deliveryAddress?: string; requiredDeliveryDate?: string;
  remarks?: string;
  status: string; allocatedQty: number; pendingQty: number;
}

export interface SalesOrderRow {
  id: number; soNumber: string;
  customerId: number; contactPersonId?: number; salesmanId?: number; deliveryPartyId?: number;
  customer: string; contactPerson?: string;
  customerPhone?: string; customerEmail?: string;
  salesman?: string; deliveryParty?: string; deliveryPartyAddress?: string;
  orderDate: string; requiredDeliveryDate?: string;
  status: string;
  deliveryMode?: string; deliveryTerms?: string; paymentTerms?: string;
  remarks?: string; insurancePolicyNo?: string;
  totalValue: number;
  emailSentAt?: string;
  linkedPoCount?: number;
  lines: SalesOrderLineDto[];
}

export interface CreateSOLineDto {
  lineNumber: number;
  materialId: number; materialCode?: string;
  gsm?: number; size?: string; unit?: string;
  orderedQty: number; qty?: number;
  rate: number; discount?: number; finalPrice?: number; amount: number;
  deliveryAddress?: string; requiredDeliveryDate?: string;
}

export interface CreateSODto {
  customerId: number; contactPersonId?: number;
  salesmanName?: string; deliveryPartyId?: number;
  orderDate: string; requiredDeliveryDate?: string;
  paymentTerms?: string; deliveryTerms?: string; deliveryMode?: string;
  remarks?: string; insurancePolicyNo?: string;
  lines: CreateSOLineDto[];
}

export interface UpdateSODto extends CreateSODto { status?: string; }

const SO_BASE = "/api/v1/sales-orders";

export const salesOrderApi = {
  list:      (p: { status?: string; customerId?: number; dateFrom?: string; dateTo?: string; search?: string; page?: number; pageSize?: number } = {}) =>
               apiFetch<Paged<SalesOrderRow>>(SO_BASE + qs({ ...p, page: p.page ?? 1, pageSize: p.pageSize ?? 50 })),
  getById:   (id: number) => apiFetch<SalesOrderRow>(`${SO_BASE}/${id}`),
  create:    (dto: CreateSODto) => apiFetch<SalesOrderRow>(SO_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:    (id: number, dto: UpdateSODto) => apiFetch<SalesOrderRow>(`${SO_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  approve:   (id: number) => apiFetch<void>(`${SO_BASE}/${id}/approve`, { method: "PATCH" }),
  remove:    (id: number) => apiFetch<void>(`${SO_BASE}/${id}`, { method: "DELETE" }),
  sendEmail:   (id: number, dto: SendMailRequest) =>
                 apiFetch<SendMailResponse>(`${SO_BASE}/${id}/send-email`, { method: "POST", body: JSON.stringify(dto) }),
  downloadPdf: (id: number) => apiDownload(`${SO_BASE}/${id}/pdf`),
};

// ── Purchase Orders ────────────────────────────────────────────────────────────

export interface POItemRow {
  id: number; lineNumber: number;
  materialId: number; description?: string;
  gsm?: number; size?: string; unit?: string;
  quantity: number; weightKg?: number;
  rate: number; discount?: number; amount: number;
  receivedQty: number; pendingQty: number;
  linkedSOLineId?: number; remark?: string;
}

export interface PORow {
  id: number; poNumber: string;
  millId: number; millName: string; millCode?: string; millUnitId?: number; millUnitName?: string;
  orderDate: string; poType: string;
  linkedSOId?: number; linkedSONumber?: string;
  deliveryMode?: string; shipmentMode?: string; blindShipment: boolean;
  invoiceParty?: string; invoicePartyId?: number;
  directCustomerId?: number; directCustomer?: string; directDeliveryAddress?: string;
  expectedDeliveryDate?: string; millSONumber?: string; paymentTerms?: string;
  totalQuantity: number; totalValue: number;
  status: string; gstPercentage?: number;
  remarks?: string; specialInstructions?: string;
  createdAt: string;
  emailSentAt?: string;
  items: POItemRow[];
}

export interface CreatePOItemDto {
  lineNumber: number; materialId: number;
  description?: string; gsm?: number; size?: string; unit?: string;
  quantity: number; weightKg?: number; rate: number; discount?: number; amount: number;
  linkedSOLineId?: number; remark?: string;
}

export interface CreatePODto {
  millId: number; millUnitId?: number; orderDate: string; poType: string;
  linkedSOId?: number; deliveryMode?: string;
  shipmentMode?: string; blindShipment: boolean;
  invoiceParty?: string; invoicePartyId?: number;
  directCustomerId?: number; directDeliveryAddress?: string;
  expectedDeliveryDate?: string; millSONumber?: string; paymentTerms?: string;
  totalQuantity: number; totalValue: number;
  gstPercentage?: number; remarks?: string; specialInstructions?: string;
  items: CreatePOItemDto[];
}

export interface UpdatePODto extends CreatePODto { status?: string; }

const PO_BASE = "/api/v1/purchase-orders";
export const poApi = {
  list:    (p: { status?: string; millId?: number; poType?: string; search?: string; requireSoApproved?: boolean; page?: number; pageSize?: number } = {}) =>
             apiFetch<Paged<PORow>>(PO_BASE + qs({ ...p, page: p.page ?? 1, pageSize: p.pageSize ?? 50 })),
  getById: (id: number) => apiFetch<PORow>(`${PO_BASE}/${id}`),
  create:  (dto: CreatePODto) => apiFetch<PORow>(PO_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:  (id: number, dto: UpdatePODto) => apiFetch<PORow>(`${PO_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  approve:   (id: number) => apiFetch<void>(`${PO_BASE}/${id}/approve`, { method: "PATCH" }),
  remove:    (id: number) => apiFetch<void>(`${PO_BASE}/${id}`, { method: "DELETE" }),
  sendEmail:   (id: number, dto: SendMailRequest) =>
                 apiFetch<SendMailResponse>(`${PO_BASE}/${id}/send-email`, { method: "POST", body: JSON.stringify(dto) }),
  downloadPdf: (id: number) => apiDownload(`${PO_BASE}/${id}/pdf`),
};

// ── Mill Tracker ──────────────────────────────────────────────────────────────

export interface MillTrackerBatchRow {
  id: number; trackerId: number; batchNo: number;
  deliveryDate?: string; quantity: number;
  lrNumber?: string; truckNumber?: string; vehicleNumber?: string;
  millInvoiceNo?: string; remarks?: string;
  createdAt: string; createdBy: string;
}

export interface MillTrackerHistoryRow {
  id: number; trackerId: number;
  action?: string; oldStatus?: string; newStatus: string;
  oldQty?: number; newQty?: number;
  readyQty?: number; dispatchedQty?: number;
  remarks?: string; updatedBy: string; updatedAt: string;
}

export interface MillTrackerRow {
  id: number; poId: number; poItemId?: number;
  poNumber: string; poDate?: string;
  millId: number; mill: string; millAddress?: string; millUnitId?: number; millUnitName?: string;
  materialId?: number; paper?: string; gsm?: number; size?: string;
  orderedQty: number; readyQty: number; dispatchedQty: number; balanceQty: number;
  rate: number; discount?: number; totalAmount: number;
  productionStatus: string; productionProgress: number;
  expectedDelivery?: string; actualDispatchDate?: string;
  lastUpdate?: string; lastUpdatedBy?: string; delayDays?: number;
  linkedSOId?: number; deliveryMode?: string; millInvoiceNo?: string;
  customerName?: string; customerId?: number;
  soNumber?: string; soDeliveryDate?: string; soCustomerId?: number; soCustomerName?: string;
  remarks?: string; millSONumber?: string; directDeliveryAddress?: string; createdAt: string;
  batches: MillTrackerBatchRow[];
  history: MillTrackerHistoryRow[];
}

export interface UpdateTrackerStatusDto {
  status: string; progress?: number; readyQty?: number; note?: string; expectedDelivery?: string;
}

export interface AddTrackerBatchDto {
  deliveryDate: string; quantity: number;
  lrNumber?: string; truckNumber?: string; vehicleNumber?: string;
  millInvoiceNo?: string; remarks?: string;
}

export interface BulkImportRowInput {
  poNumber: string; readyQty?: number; status?: string; expectedDelivery?: string; remarks?: string;
}

export interface BulkImportResultDto {
  updated: number; skipped: number; errors: string[];
}

// ── Truck Load Plans ───────────────────────────────────────────────────────────

export type TlpLoadType = "Load 1" | "Load 2" | "Load 3" | "Last Load";

export interface TruckLoadPlanLoadApiDto {
  id: number; loadType: TlpLoadType; loadSequence: number; address?: string;
}

export interface CreateTruckLoadPlanLoadApiDto {
  loadType: TlpLoadType; loadSequence: number; address?: string;
}

export interface TruckLoadPlanItemApiDto {
  id: number; planId: number; trackerId?: number;
  poNumber?: string; soNumber?: string;
  paper?: string; gsm?: number; size?: string;
  customerName?: string; mill?: string;
  quantity: number; planQty?: number; weightKg?: number;
  loadOrder: number; loadType?: TlpLoadType;
  deliveryLocation?: string; deliveryAddress?: string;
  millInvoiceNo?: string; deliveryBillNo?: string;
}

export interface TruckLoadPlanApiDto {
  id: number; planNumber: string; planDate: string;
  truckNumber?: string; truckType?: string; transporterName?: string;
  driverName?: string; driverPhone?: string;
  truckCapacityKg?: number; freightAmount?: number; origin?: string;
  deliveryMode: string;
  millInvoiceNo?: string; deliveryBillNo?: string;
  plannedLoadDate?: string; plannedDeliveryDate?: string;
  actualLoadDate?: string; actualDeliveryDate?: string;
  status: string; remarks?: string; createdAt: string;
  items: TruckLoadPlanItemApiDto[];
  loads?: TruckLoadPlanLoadApiDto[];
}

export interface CreateTruckLoadPlanItemApiDto {
  trackerId?: number; poNumber?: string; soNumber?: string;
  paper?: string; gsm?: number; size?: string;
  customerName?: string; mill?: string;
  quantity: number; planQty?: number; weightKg?: number;
  loadOrder: number; loadType?: TlpLoadType;
  deliveryLocation?: string; deliveryAddress?: string;
  millInvoiceNo?: string; deliveryBillNo?: string;
}

export interface CreateTruckLoadPlanApiDto {
  truckNumber?: string; truckType?: string; transporterName?: string;
  driverName?: string; driverPhone?: string;
  truckCapacityKg?: number; freightAmount?: number; origin?: string;
  deliveryMode: string;
  millInvoiceNo?: string; deliveryBillNo?: string;
  plannedLoadDate?: string; plannedDeliveryDate?: string;
  remarks?: string;
  loads?: CreateTruckLoadPlanLoadApiDto[];
  items: CreateTruckLoadPlanItemApiDto[];
}

export interface UpdateTruckLoadPlanStatusApiDto {
  status: string;
  actualLoadDate?: string; actualDeliveryDate?: string;
  remarks?: string;
}

const TLP_BASE = "/api/v1/truck-load-plans";
export const truckLoadPlanApi = {
  list:         (p: { status?: string; truckNumber?: string; search?: string; page?: number; pageSize?: number } = {}) =>
                  apiFetch<Paged<TruckLoadPlanApiDto>>(TLP_BASE + qs({ ...p, page: p.page ?? 1, pageSize: p.pageSize ?? 50 })),
  getById:      (id: number) => apiFetch<TruckLoadPlanApiDto>(`${TLP_BASE}/${id}`),
  create:       (dto: CreateTruckLoadPlanApiDto) =>
                  apiFetch<TruckLoadPlanApiDto>(TLP_BASE, { method: "POST", body: JSON.stringify(dto) }),
  updateStatus: (id: number, dto: UpdateTruckLoadPlanStatusApiDto) =>
                  apiFetch<TruckLoadPlanApiDto>(`${TLP_BASE}/${id}/status`, { method: "PATCH", body: JSON.stringify(dto) }),
  remove:       (id: number) => apiFetch<void>(`${TLP_BASE}/${id}`, { method: "DELETE" }),
};

// ── GRNs ──────────────────────────────────────────────────────────────────────

export interface GrnStatusLogEntry {
  fromStatus?: string; toStatus: string;
  remarks?: string; changedBy: string; changedAt: string;
}

export interface GrnRow {
  id: number; grnNumber: string; grnDate: string; status: string;
  poId: number; poNumber: string;
  millTrackerId?: number; sourceLoadPlanId?: number; loadPlanNumber?: string;
  millId: number; millName: string;
  materialId: number; paper: string; gsm?: number; size?: string;
  orderedQty: number; previouslyReceivedQty: number; receivedQty: number;
  shortQty: number; damagedQty: number; balanceQty: number;
  receivedWeightMt?: number;
  // Delivery routing
  grnDeliveryMode: string;  // StockIn | DirectToClient | Split
  stockQty: number;         // qty entering inventory.StockLots
  directQty: number;        // qty going direct to client
  directClientId?: number;
  directClientName?: string;
  // PO billing mode (Normal | InvoiceOverride | Blind)
  billingMode: string;
  blindShipment: boolean;
  effectiveClientName?: string;
  // Warehouse / lot
  warehouseId?: number; warehouseName?: string; binLocation?: string;
  lotNumber?: string; vehicleNumber?: string; lrNumber?: string;
  dispatchDate?: string;
  condition?: string; qcResult?: string; qualityGrade?: string;
  itemInvoiceNo?: string; billingRate?: number;
  packingType?: string; sheetsPerPacket?: number; packetsPerBundle?: number;
  noOfPackets?: number; noOfBundles?: number;
  linkedSoId?: number; linkedSoNumber?: string; customerName?: string;
  createdBy: string; createdAt: string;
}

export interface GrnDetailRow extends GrnRow {
  purchaseInvoiceNumber?: string; millChallanNumber?: string;
  expectedWeightMt?: number; suggestedBin?: string;
  driverName?: string; receivedBy?: string;
  freightAmount: number; unloadingCharges: number; invoiceEligible: boolean;
  remarks?: string; qcApprovedBy?: string; qcDate?: string;
  overrideClientName?: string;    // mill-facing name for InvoiceOverride mode
  directDeliveryAddress?: string; // for direct-to-client print
  // SO chain
  soDate?: string; soCustomerName?: string; soSalesmanName?: string;
  soOrderedQty?: number; soRate?: number;
  // PO chain
  poDate?: string; poSupplierName?: string; poRate?: number;
  // TLP chain
  tlpDate?: string; tlpTruckNumber?: string; tlpTransporter?: string;
  statusLog: GrnStatusLogEntry[];
}

export interface CreateGrnDto {
  millTrackerId: number;
  sourceLoadPlanId?: number;
  grnDate: string;
  purchaseInvoiceNumber?: string; millChallanNumber?: string;
  dispatchDate?: string;
  itemInvoiceNo?: string;
  billingRate?: number;
  receivedQty: number; damagedQty: number; shortQty: number;
  receivedWeightMt?: number;
  warehouseId?: number; binLocationId?: number;
  condition?: string; qcResult?: string; qualityGrade?: string;
  // Packing format
  packingType: string;        // Sheets | Packets | Bundle
  sheetsPerPacket?: number;
  packetsPerBundle?: number;
  noOfPackets?: number;
  noOfBundles?: number;
  // Delivery routing
  grnDeliveryMode: string;  // StockIn | DirectToClient | Split
  directQty: number;
  directClientId?: number;
  lrNumber?: string; vehicleNumber?: string; driverName?: string;
  freightAmount: number; unloadingCharges: number; invoiceEligible: boolean;
  receivedBy?: string; remarks?: string;
}

export interface UpdateGrnDto {
  warehouseId?: number; binLocationId?: number;
  remarks?: string; receivedBy?: string;
}

export interface UpdateGrnStatusDto {
  status: string; remarks?: string;
  qcApprovedBy?: string; qcDate?: string;
}

const GRN_BASE = "/api/v1/grns";
export const grnApi = {
  list:         (p: { status?: string; millId?: number; grnDate?: string; poId?: number; search?: string; page?: number; pageSize?: number } = {}) =>
                  apiFetch<Paged<GrnRow>>(GRN_BASE + qs({ ...p, page: p.page ?? 1, pageSize: p.pageSize ?? 50 })),
  getById:      (id: number) => apiFetch<GrnDetailRow>(`${GRN_BASE}/${id}`),
  create:       (dto: CreateGrnDto) =>
                  apiFetch<GrnRow>(GRN_BASE, { method: "POST", body: JSON.stringify(dto) }),
  update:       (id: number, dto: UpdateGrnDto) =>
                  apiFetch<GrnDetailRow>(`${GRN_BASE}/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  updateStatus: (id: number, dto: UpdateGrnStatusDto) =>
                  apiFetch<GrnDetailRow>(`${GRN_BASE}/${id}/status`, { method: "PATCH", body: JSON.stringify(dto) }),
  remove:       (id: number) => apiFetch<void>(`${GRN_BASE}/${id}`, { method: "DELETE" }),
};

// ── Stock Lots ────────────────────────────────────────────────────────────────

export interface StockLotRow {
  id: number; lotNumber: string;
  grnId: number; grnNumber: string; grnDate: string;
  materialId: number; paper: string; gsm?: number; size?: string;
  millId: number; millName: string;
  warehouseId?: number; warehouseName?: string; binLocation?: string;
  openingQty: number; currentQty: number;
  allocatedQty: number; availableQty: number;
  costPerUnit?: number; totalCost?: number;
  condition?: string; qualityGrade?: string;
  status: string; fifoSequence: number;
  poId: number; poNumber: string;
  loadPlanId?: number; loadPlanNumber?: string;
  linkedSoId?: number; linkedSoNumber?: string;
  customerName?: string;
  createdBy: string; createdAt: string;
}

export interface StockLotDetailRow extends StockLotRow {
  grnQcResult?: string; grnVehicleNumber?: string;
  grnLrNumber?: string; grnCondition?: string;
  tlpTruckNumber?: string; tlpTransporter?: string;
  tlpDate?: string; tlpOrigin?: string; tlpStatus?: string;
  soDate?: string; soCustomerName?: string;
  poDate?: string; poRate?: number;
  billingMode: string; effectiveClientName?: string;
}

export interface UpdateStockLotDto {
  currentQty?: number;
  warehouseId?: number;
  binLocationId?: number;
  qualityGrade?: string;
}

const STOCK_LOT_BASE = "/api/v1/stock-lots";
export const stockLotApi = {
  list:    (p: { status?: string; warehouseId?: number; materialId?: number; millId?: number; noBin?: boolean; search?: string; page?: number; pageSize?: number } = {}) =>
             apiFetch<Paged<StockLotRow>>(STOCK_LOT_BASE + qs({ ...p, page: p.page ?? 1, pageSize: p.pageSize ?? 50 })),
  getById: (id: number) => apiFetch<StockLotDetailRow>(`${STOCK_LOT_BASE}/${id}`),
  update:  (id: number, dto: UpdateStockLotDto) =>
             apiFetch<StockLotDetailRow>(`${STOCK_LOT_BASE}/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
  remove:  (id: number) => apiFetch<void>(`${STOCK_LOT_BASE}/${id}`, { method: "DELETE" }),
};

// ── Mill Tracker ──────────────────────────────────────────────────────────────

const MT_BASE = "/api/v1/mill-tracker";
export const millTrackerApi = {
  list:         (p: { poId?: number; millId?: number; status?: string; customerId?: number; search?: string; page?: number; pageSize?: number } = {}) =>
                  apiFetch<Paged<MillTrackerRow>>(MT_BASE + qs({ ...p, page: p.page ?? 1, pageSize: p.pageSize ?? 200 })),
  getById:      (id: number) => apiFetch<MillTrackerRow>(`${MT_BASE}/${id}`),
  getByPo:      (poId: number) => apiFetch<MillTrackerRow[]>(`${MT_BASE}/by-po/${poId}`),
  updateStatus: (id: number, dto: UpdateTrackerStatusDto) =>
                  apiFetch<MillTrackerRow>(`${MT_BASE}/${id}/status`, { method: "PATCH", body: JSON.stringify(dto) }),
  addBatch:     (id: number, dto: AddTrackerBatchDto) =>
                  apiFetch<MillTrackerBatchRow>(`${MT_BASE}/${id}/batches`, { method: "POST", body: JSON.stringify(dto) }),
  bulkImport:   (rows: BulkImportRowInput[]) =>
                  apiFetch<BulkImportResultDto>(`${MT_BASE}/bulk-import`, { method: "POST", body: JSON.stringify(rows) }),
  remove:       (id: number) => apiFetch<void>(`${MT_BASE}/${id}`, { method: "DELETE" }),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardOrderRow {
  id: number;
  number: string;
  party: string;
  status: string;
  totalValue: number;
  orderDate: string;
}

export interface DashboardMillTrackerRow {
  id: number;
  material: string;
  mill: string;
  orderedQty: number;
  productionStatus: string;
  productionProgress: number;
}

export interface DashboardStatusItem {
  name: string;
  value: number;
}

export interface DashboardSummaryDto {
  openSoCount: number;
  openSoValue: number;
  openPoCount: number;
  openPoValue: number;
  pendingGrnCount: number;
  availableStockLots: number;
  availableStockQty: number;
  millTrackerTotal: number;
  millTrackerReady: number;
  recentSalesOrders: DashboardOrderRow[];
  recentPurchaseOrders: DashboardOrderRow[];
  millTrackers: DashboardMillTrackerRow[];
  soStatusBreakdown: DashboardStatusItem[];
  poStatusBreakdown: DashboardStatusItem[];
}

export const dashboardApi = {
  summary: () => apiFetch<DashboardSummaryDto>("/api/v1/dashboard/summary"),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export interface NotificationDto {
  key: string;
  type: string;
  title: string;
  body: string;
  refNumber: string;
  href: string;
  isRead: boolean;
  notifTs: string;
}

const NOTIF_BASE = "/api/v1/notifications";
export const notificationApi = {
  getAll:       () => apiFetch<NotificationDto[]>(NOTIF_BASE),
  markRead:     (key: string) =>
                  apiFetch<void>(`${NOTIF_BASE}/${encodeURIComponent(key)}/read`, { method: "POST" }),
  markAllRead:  (keys: string[]) =>
                  apiFetch<void>(`${NOTIF_BASE}/read-all`, { method: "POST", body: JSON.stringify(keys) }),
  dismiss:      (key: string) =>
                  apiFetch<void>(`${NOTIF_BASE}/${encodeURIComponent(key)}`, { method: "DELETE" }),
  dismissAll:   (keys: string[]) =>
                  apiFetch<void>(NOTIF_BASE, { method: "DELETE", body: JSON.stringify(keys) }),
};
