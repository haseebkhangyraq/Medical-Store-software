// ─── Domain types for MediCore Pharmacy ERP (demo) ────────────────────────────

export type ID = string;

export type Role = "administrator" | "pharmacist" | "cashier" | "inventory_manager";

export interface StaffUser {
  id: ID;
  name: string;
  username: string;
  role: Role;
  phone: string;
  active: boolean;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: ID;
  userId: ID;
  userName: string;
  action: string;
  detail: string;
  date: string;
}

export interface Batch {
  id: ID;
  batchNo: string;
  mfgDate: string; // yyyy-mm-dd
  expiryDate: string; // yyyy-mm-dd
  purchasePrice: number;
  quantity: number;
  receivedDate: string;
}

export type MedicineCategory =
  | "Tablet"
  | "Syrup"
  | "Capsule"
  | "Injection"
  | "Ointment"
  | "Drops"
  | "Suspension"
  | "Sachet"
  | "Inhaler"
  | "Suppository";

export interface Medicine {
  id: ID;
  name: string;
  genericName: string;
  brandName: string;
  category: MedicineCategory;
  barcode: string;
  sku: string;
  manufacturer: string;
  supplierId: ID;
  unitType: string; // pcs / bottle / tube / vial...
  rackLocation: string;
  prescriptionRequired: boolean;
  minStockLevel: number;
  retailPrice: number;
  wholesalePrice: number;
  taxRate: number; // % per item
  description: string;
  batches: Batch[];
  createdAt: string;
}

export interface Supplier {
  id: ID;
  name: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxNo: string;
  openingBalance: number;
  createdAt: string;
}

export interface Customer {
  id: ID;
  name: string;
  phone: string;
  address: string;
  type: "walk-in" | "regular" | "wholesale";
  creditLimit: number;
  openingBalance: number;
  createdAt: string;
}

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "mobile_wallet" | "split";

export interface SplitPaymentPart {
  method: Exclude<PaymentMethod, "split">;
  amount: number;
}

export interface SaleItem {
  id: ID;
  medicineId: ID;
  medicineName: string;
  batchId: ID;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  unitPrice: number;
  costPrice: number; // batch purchase price captured at sale time
  discount: number; // per line total
  taxRate: number;
  total: number; // qty*price - discount + tax
}

export interface Sale {
  id: ID;
  invoiceNo: string;
  date: string; // ISO
  customerId: ID;
  customerName: string;
  items: SaleItem[];
  itemDiscountTotal: number;
  invoiceDiscount: number;
  taxTotal: number;
  subtotal: number;
  total: number;
  paidAmount: number;
  changeReturned: number;
  paymentMethod: PaymentMethod;
  splitParts?: SplitPaymentPart[];
  status: "completed" | "partially_returned" | "returned";
  cashierName: string;
  prescriptionNote?: string;
}

export type PurchaseStatus = "ordered" | "partially_received" | "received" | "cancelled";

export interface PurchaseItem {
  id: ID;
  medicineId: ID;
  medicineName: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
}

export interface Purchase {
  id: ID;
  refNo: string;
  date: string; // ISO
  supplierId: ID;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  status: PurchaseStatus;
  notes?: string;
  createdAt: string;
}

export interface Receiving {
  id: ID;
  receiveNo: string;
  purchaseId: ID;
  refNo: string;
  supplierId: ID;
  supplierName: string;
  date: string;
  items: {
    id: ID;
    medicineId: ID;
    medicineName: string;
    batchId: ID;
    batchNo: string;
    expiryDate: string;
    mfgDate: string;
    quantity: number;
    unitCost: number;
  }[];
  total: number;
  receivedBy: string;
}

export interface Issuance {
  id: ID;
  voucherNo: string;
  date: string;
  destination: string;
  reason: "internal_use" | "damaged" | "expired" | "sample" | "adjustment" | "other";
  authorizedBy: string;
  items: {
    id: ID;
    medicineId: ID;
    medicineName: string;
    batchId: ID;
    batchNo: string;
    quantity: number;
    unitCost: number;
  }[];
  totalValue: number;
  notes?: string;
}

export interface StockTransfer {
  id: ID;
  transferNo: string;
  date: string;
  fromLocation: string;
  toLocation: string;
  authorizedBy: string;
  items: {
    id: ID;
    medicineId: ID;
    medicineName: string;
    batchId: ID;
    batchNo: string;
    quantity: number;
  }[];
  notes?: string;
}

export interface SalesReturn {
  id: ID;
  returnNo: string;
  date: string;
  saleId: ID;
  invoiceNo: string;
  customerId: ID;
  customerName: string;
  items: {
    id: ID;
    saleItemId: ID;
    medicineId: ID;
    medicineName: string;
    batchId: ID;
    batchNo: string;
    quantity: number;
    unitPrice: number;
    refundAmount: number;
    restock: boolean;
  }[];
  reason: string;
  totalRefund: number;
  restockMethod: "cash_refund" | "store_credit" | "balance_adjustment";
}

export interface PurchaseReturn {
  id: ID;
  returnNo: string;
  date: string;
  purchaseId: ID;
  refNo: string;
  supplierId: ID;
  supplierName: string;
  items: {
    id: ID;
    medicineId: ID;
    medicineName: string;
    batchId: ID;
    batchNo: string;
    quantity: number;
    unitCost: number;
    refundAmount: number;
  }[];
  reason: string;
  totalRefund: number;
}

export interface SupplierPayment {
  id: ID;
  paymentNo: string;
  date: string;
  supplierId: ID;
  supplierName: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export interface CustomerPayment {
  id: ID;
  paymentNo: string;
  date: string;
  customerId: ID;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export type ExpenseCategory =
  | "rent"
  | "electricity"
  | "salaries"
  | "transportation"
  | "maintenance"
  | "marketing"
  | "other";

export interface Expense {
  id: ID;
  expenseNo: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  method: PaymentMethod;
  recordedBy: string;
}

export interface InventoryMovement {
  id: ID;
  date: string;
  type:
    | "sale"
    | "purchase_receive"
    | "sale_return"
    | "purchase_return"
    | "issuance"
    | "transfer"
    | "adjustment"
    | "expiry_removal"
    | "opening";
  medicineId: ID;
  medicineName: string;
  batchId: ID;
  batchNo: string;
  qtyIn: number;
  qtyOut: number;
  unitCost: number;
  refNo: string;
  note: string;
  userName: string;
}

export interface CashEntry {
  id: ID;
  date: string;
  direction: "in" | "out";
  category: string;
  refNo: string;
  description: string;
  amount: number;
  method: PaymentMethod;
}

export interface PharmacySettings {
  pharmacyName: string;
  logoText: string;
  address: string;
  phone: string;
  email: string;
  licenseNo: string;
  currency: string;
  currencyCode: string;
  defaultTaxRate: number;
  lowStockThreshold: number;
  expiryWarnDays: number;
  invoiceFooter: string;
  receiptWidth: "thermal80" | "a4";
  showLogoOnReceipt: boolean;
  branchName: string;
  storageLocations: string[];
}

export interface AppState {
  medicines: Medicine[];
  suppliers: Supplier[];
  customers: Customer[];
  sales: Sale[];
  purchases: Purchase[];
  receivings: Receiving[];
  issuances: Issuance[];
  transfers: StockTransfer[];
  salesReturns: SalesReturn[];
  purchaseReturns: PurchaseReturn[];
  supplierPayments: SupplierPayment[];
  customerPayments: CustomerPayment[];
  expenses: Expense[];
  movements: InventoryMovement[];
  cashEntries: CashEntry[];
  users: StaffUser[];
  activityLog: ActivityLogEntry[];
  settings: PharmacySettings;
  currentUser: StaffUser | null;
  _seq: number;
  _hydrated: boolean;
  _version: number;
  /** Set when the user explicitly cleared all data — prevents auto-reseeding on reload. */
  demoCleared: boolean;
}
