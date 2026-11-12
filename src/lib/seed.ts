import type {
  AppState, Medicine, Supplier, Customer, Sale, Purchase, Receiving, Issuance,
  Expense, InventoryMovement, CashEntry, StaffUser, ActivityLogEntry, Batch,
} from "./types";
import { addDays, toISODate, uid } from "./utils";
import { allocateFefo, sellableStock } from "./stock";

// Deterministic PRNG so demo data is stable between resets.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const r = rng(20240610);
const ri = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[ri(0, arr.length - 1)];

const today = toISODate(new Date());

// ─── Suppliers ────────────────────────────────────────────────────────────────
const SUPPLIERS: Array<[string, string, string, string]> = [
  ["MediSource Distributors", "Kamran Sheikh", "0300-4451226", "Plot 22, Ferozepur Road, Lahore"],
  ["Pak Pharma Trade", "Adeel Raza", "0321-8764310", "Shop 7, Medicine Market, Karachi"],
  ["Healing Cross Supplies", "Farhan Malik", "0333-2210447", "Saddar Bazaar, Rawalpindi"],
  ["Curex Wholesale", "Nadia Aslam", "0345-9903121", "Block C, Johar Town, Lahore"],
  ["NovaMed Traders", "Shahid Iqbal", "0301-7789456", "Chowk Kumharanwala, Multan"],
  ["SehatLink Distributors", "Rabia Noor", "0312-4563789", "University Road, Peshawar"],
  ["Karachi MediMart", "Zubair Ahmed", "0308-2234112", "Saddar, Karachi"],
  ["Punjab Medicine House", "Tanveer Butt", "0334-5567098", "Shahalam Market, Lahore"],
  ["Islamabad Pharma Supply", "Hamza Yousaf", "0332-8812455", "Aabpara Market, Islamabad"],
  ["National Drug House", "Imran Baig", "0311-6640991", "Circular Road, Quetta"],
];

// ─── Medicines: name, generic, brand, category, manufacturer, unit, retail, wholesale, rx, rack ──
const MEDICINES: Array<[string, string, string, Medicine["category"], string, string, number, number, boolean, string]> = [
  ["Panamol 500mg Tablet", "Paracetamol", "Getwell", "Tablet", "Getwell Pharma", "Strip of 10", 25, 21, false, "A-1"],
  ["Ibumax 400mg Tablet", "Ibuprofen", "NovaMed", "Tablet", "NovaPharm Industries", "Strip of 10", 38, 32, false, "A-2"],
  ["Amoxi-Clav 625mg Tablet", "Amoxicillin + Clavulanic Acid", "Curex", "Tablet", "Curex Pharmaceuticals", "Strip of 6", 320, 285, true, "A-3"],
  ["Omezol 20mg Capsule", "Omeprazole", "HealingCross", "Capsule", "Healing Cross Labs", "Strip of 10", 120, 102, false, "A-4"],
  ["Metrozol 400mg Tablet", "Metronidazole", "Sehat", "Tablet", "Sehat Pharma", "Strip of 10", 55, 46, true, "A-5"],
  ["Cetirix 10mg Tablet", "Cetirizine", "LifeLine", "Tablet", "LifeLine Pharma", "Strip of 10", 40, 33, false, "A-6"],
  ["Metforin 500mg Tablet", "Metformin", "Vitality", "Tablet", "Vitality Labs", "Strip of 10", 62, 53, true, "B-1"],
  ["Bisotan 5mg Tablet", "Bisoprolol", "AlphaMed", "Tablet", "AlphaMed Labs", "Strip of 10", 95, 81, true, "B-2"],
  ["Atorvin 20mg Tablet", "Atorvastatin", "PureCure", "Tablet", "PureCure Pharma", "Strip of 10", 130, 112, true, "B-3"],
  ["Salbusal Inhaler 100mcg", "Salbutamol", "NovaMed", "Inhaler", "NovaPharm Industries", "Piece", 420, 370, true, "B-4"],
  ["Brufen Kid Syrup 60ml", "Ibuprofen", "NovaMed", "Syrup", "NovaPharm Industries", "Bottle", 95, 82, false, "C-1"],
  ["Paracal Syrup 120ml", "Paracetamol", "Getwell", "Syrup", "Getwell Pharma", "Bottle", 75, 64, false, "C-1"],
  ["Amoxi-Clav Syrup 60ml", "Amoxicillin + Clavulanic Acid", "Curex", "Syrup", "Curex Pharmaceuticals", "Bottle", 285, 250, true, "C-2"],
  ["Carbamol 200mg Tablet", "Carbamazepine", "Vitality", "Tablet", "Vitality Labs", "Strip of 10", 140, 121, true, "C-3"],
  ["Neurobin B12 Tablet", "Vitamin B Complex", "LifeLine", "Tablet", "LifeLine Pharma", "Strip of 10", 110, 94, false, "C-4"],
  ["Calcium-D Sachet", "Calcium + Vitamin D3", "AlphaMed", "Sachet", "AlphaMed Labs", "Sachet", 55, 47, false, "C-5"],
  ["Zinctral Syrup 100ml", "Zinc", "Sehat", "Syrup", "Sehat Pharma", "Bottle", 130, 112, false, "D-1"],
  ["ORS Orange Sachet", "Oral Rehydration Salt", "PureCure", "Sachet", "PureCure Pharma", "Sachet", 30, 25, false, "D-2"],
  ["Insulmix 30/70 Vial 100IU", "Insulin Mixtard", "HealingCross", "Injection", "Healing Cross Labs", "Vial", 1250, 1180, true, "FRIDGE-1"],
  ["Insuglar Penfill 100IU", "Insulin Glargine", "HealingCross", "Injection", "Healing Cross Labs", "Penfill", 2100, 1980, true, "FRIDGE-2"],
  ["Lidocain-X Injection 2%", "Lidocaine", "Curex", "Injection", "Curex Pharmaceuticals", "Vial", 85, 72, true, "E-1"],
  ["Epineph-A Injection 1mg", "Adrenaline", "NovaPharm", "Injection", "NovaPharm Industries", "Ampoule", 160, 140, true, "E-2"],
  ["Dicloran-J Injection 75mg", "Diclofenac Sodium", "Vitality", "Injection", "Vitality Labs", "Ampoule", 45, 38, true, "E-3"],
  ["Cefixor 200mg Capsule", "Cefixime", "AlphaMed", "Capsule", "AlphaMed Labs", "Strip of 6", 295, 262, true, "E-4"],
  ["Azitrax 500mg Tablet", "Azithromycin", "Getwell", "Tablet", "Getwell Pharma", "Strip of 6", 250, 218, true, "E-5"],
  ["Levoflox 500mg Tablet", "Levofloxacin", "Curex", "Tablet", "Curex Pharmaceuticals", "Strip of 10", 285, 250, true, "F-1"],
  ["Ciprol-D Eye Drops 5ml", "Ciprofloxacin", "LifeLine", "Drops", "LifeLine Pharma", "Bottle", 145, 126, true, "F-2"],
  ["Timoptic-L Eye Drops 5ml", "Timolol", "PureCure", "Drops", "PureCure Pharma", "Bottle", 195, 172, true, "F-2"],
  ["Beconase-S Nasal Spray", "Beclomethasone", "Sehat", "Drops", "Sehat Pharma", "Bottle", 340, 300, true, "F-3"],
  ["Diclogel Gel 30g", "Diclofenac Diethylamine", "NovaMed", "Ointment", "NovaPharm Industries", "Tube", 180, 158, false, "F-4"],
  ["Mupiderm Ointment 15g", "Mupirocin", "HealingCross", "Ointment", "Healing Cross Labs", "Tube", 260, 230, true, "F-5"],
  ["Betameth-C Cream 15g", "Betamethasone", "Getwell", "Ointment", "Getwell Pharma", "Tube", 120, 104, true, "G-1"],
  ["Canfugel Cream 20g", "Clotrimazole", "Vitality", "Ointment", "Vitality Labs", "Tube", 150, 132, false, "G-2"],
  ["Neobact Ointment 15g", "Neomycin + Bacitracin", "AlphaMed", "Ointment", "AlphaMed Labs", "Tube", 175, 152, true, "G-3"],
  ["Esozol 40mg Capsule", "Esomeprazole", "Curex", "Capsule", "Curex Pharmaceuticals", "Strip of 14", 265, 234, true, "G-4"],
  ["Pregab 75mg Capsule", "Pregabalin", "LifeLine", "Capsule", "LifeLine Pharma", "Strip of 14", 355, 318, true, "G-5"],
  ["Duloxa 30mg Capsule", "Duloxetine", "NovaPharm", "Capsule", "NovaPharm Industries", "Strip of 14", 420, 380, true, "H-1"],
  ["Clopid 75mg Tablet", "Clopidogrel", "PureCure", "Tablet", "PureCure Pharma", "Strip of 10", 210, 186, true, "H-2"],
  ["Furosix 40mg Tablet", "Furosemide", "Sehat", "Tablet", "Sehat Pharma", "Strip of 10", 45, 38, true, "H-3"],
  ["Valtan 160mg Tablet", "Valsartan", "AlphaMed", "Tablet", "AlphaMed Labs", "Strip of 14", 330, 296, true, "H-4"],
  ["Amlovas 5mg Tablet", "Amlodipine", "Getwell", "Tablet", "Getwell Pharma", "Strip of 10", 58, 49, true, "H-5"],
  ["Spirolac 25mg Tablet", "Spironolactone", "Vitality", "Tablet", "Vitality Labs", "Strip of 10", 88, 76, true, "H-6"],
  ["Feronia-X Syrup 150ml", "Ferrous Sulphate + Folic Acid", "LifeLine", "Syrup", "LifeLine Pharma", "Bottle", 165, 144, false, "I-1"],
  ["Polybion-V Syrup 120ml", "Multivitamin", "HealingCross", "Syrup", "Healing Cross Labs", "Bottle", 145, 126, false, "I-1"],
  ["D-Clux Drops 15ml", "Cholecalciferol", "PureCure", "Drops", "PureCure Pharma", "Bottle", 350, 312, false, "I-2"],
  ["Nasocon Drops 10ml", "Oxymetazoline", "Sehat", "Drops", "Sehat Pharma", "Bottle", 95, 83, false, "I-3"],
  ["Moxy-D Eye Drops 5ml", "Moxifloxacin", "Curex", "Drops", "Curex Pharmaceuticals", "Bottle", 285, 252, true, "I-4"],
  ["Glysup Suppository", "Glycerin", "Getwell", "Suppository", "Getwell Pharma", "Pack of 10", 70, 60, false, "J-1"],
  ["Bisasup 10mg Suppository", "Bisacodyl", "AlphaMed", "Suppository", "AlphaMed Labs", "Pack of 10", 95, 82, false, "J-2"],
  ["Tosqin Syrup 100ml", "Dextromethorphan", "NovaPharm", "Syrup", "NovaPharm Industries", "Bottle", 135, 118, false, "J-3"],
];

const BATCH_SPEC: Array<{ index: number; count: number; offsetDays: number[]; qty: number[]; note?: string }> = [
  // Forced special cases first
  { index: 0, count: 1, offsetDays: [420], qty: [0], note: "out-of-stock" },
  { index: 5, count: 2, offsetDays: [-45, 260], qty: [80, 240], note: "has-expired-batch" },
  { index: 12, count: 2, offsetDays: [-12, 180], qty: [35, 110], note: "has-expired-batch" },
  { index: 8, count: 2, offsetDays: [18, 300], qty: [60, 150], note: "near-expiry" },
  { index: 17, count: 2, offsetDays: [9, 340], qty: [90, 200], note: "near-expiry" },
  { index: 23, count: 2, offsetDays: [26, 380], qty: [45, 130], note: "near-expiry" },
  { index: 29, count: 2, offsetDays: [55, 400], qty: [30, 60], note: "near-expiry-60" },
  { index: 2, count: 2, offsetDays: [85, 460], qty: [24, 130], note: "low-stock" },
  { index: 18, count: 1, offsetDays: [150], qty: [8], note: "low-stock-insulin" },
  { index: 34, count: 2, offsetDays: [70, 430], qty: [10, 90], note: "low-stock" },
  { index: 6, count: 2, offsetDays: [240, 540], qty: [420, 180], note: "overstock" },
];

export function buildSeedData(): Omit<AppState, "_hydrated"> {
  const medicines: Medicine[] = [];
  const suppliers: Supplier[] = [];
  const customers: Customer[] = [];
  const sales: Sale[] = [];
  const purchases: Purchase[] = [];
  const receivings: Receiving[] = [];
  const issuances: Issuance[] = [];
  const movements: InventoryMovement[] = [];
  const cashEntries: CashEntry[] = [];
  const expenses: Expense[] = [];
  const activityLog: ActivityLogEntry[] = [];

  const addMovement = (m: Omit<InventoryMovement, "id">) => movements.push({ id: uid("mv"), ...m });
  const addCash = (c: Omit<CashEntry, "id">) => cashEntries.push({ id: uid("cash"), ...c });

  // ── Suppliers ──
  SUPPLIERS.forEach(([company, contact, phone, address], i) => {
    suppliers.push({
      id: `sup_${i + 1}`,
      name: company,
      companyName: `${company} (Pvt) Ltd`,
      contactPerson: contact,
      phone,
      email: `orders@${company.toLowerCase().replace(/[^a-z]+/g, "")}.com.pk`,
      address,
      taxNo: `NTN-${ri(1000000, 9999999)}-${ri(1, 9)}`,
      openingBalance: i < 3 ? [42000, 0, 18500][i] : 0,
      createdAt: addDays(today, -ri(200, 500)),
    });
  });

  // ── Medicines + opening batches ──
  MEDICINES.forEach(([name, generic, brand, category, manufacturer, unit, retail, wholesale, rx, rack], i) => {
    const mid = `med_${i + 1}`;
    const spec = BATCH_SPEC.find((s) => s.index === i);
    const batchCount = spec ? spec.count : ri(1, 3);
    const batches: Batch[] = [];
    for (let b = 0; b < batchCount; b++) {
      const offset = spec ? spec.offsetDays[b] : ri(90, 650);
      const qty = spec ? spec.qty[b] : ri(60, 500);
      const cost = Math.round(retail * (0.62 + r() * 0.14));
      const batch: Batch = {
        id: `bt_${i + 1}_${b + 1}`,
        batchNo: `B${ri(2400, 2699)}-${ri(10, 99)}`,
        mfgDate: addDays(today, offset - 720),
        expiryDate: addDays(today, offset),
        purchasePrice: cost,
        quantity: qty,
        receivedDate: addDays(today, -ri(20, 200)),
      };
      batches.push(batch);
      if (qty > 0) {
        addMovement({
          date: batch.receivedDate, type: "opening", medicineId: mid, medicineName: name,
          batchId: batch.id, batchNo: batch.batchNo, qtyIn: qty, qtyOut: 0, unitCost: cost,
          refNo: "OPENING", note: "Opening stock", userName: "System",
        });
      }
    }
    medicines.push({
      id: mid,
      name, genericName: generic, brandName: brand,
      category,
      barcode: `84${String(100000000 + i * 977).slice(0, 9)}`,
      sku: `MED-${String(i + 1).padStart(4, "0")}`,
      manufacturer,
      supplierId: suppliers[i % suppliers.length].id,
      unitType: unit,
      rackLocation: rack,
      prescriptionRequired: rx,
      minStockLevel: ri(20, 50),
      retailPrice: retail,
      wholesalePrice: wholesale,
      taxRate: rx ? 1 : 0.5,
      description: `${generic} ${brand}. Store as per label instructions.`,
      batches,
      createdAt: addDays(today, -ri(100, 400)),
    });
  });

  // ── Purchases + receiving ──
  let poSeq = 1;
  for (let p = 0; p < 10; p++) {
    const supplier = suppliers[p % suppliers.length];
    const date = addDays(today, -ri(2, 58));
    const itemCount = ri(2, 4);
    const items = [];
    for (let j = 0; j < itemCount; j++) {
      const m = medicines[ri(0, medicines.length - 1)];
      items.push({
        id: uid("pi"), medicineId: m.id, medicineName: m.name,
        orderedQty: ri(40, 200), receivedQty: 0, unitCost: Math.round(m.retailPrice * 0.66),
        batchNo: `B${ri(2700, 2899)}-${ri(10, 99)}`, mfgDate: addDays(today, -ri(30, 180)), expiryDate: addDays(today, ri(180, 640)),
      });
    }
    const subtotal = items.reduce((s, it) => s + it.orderedQty * it.unitCost, 0);
    const discount = p % 4 === 0 ? Math.round(subtotal * 0.03) : 0;
    const total = subtotal - discount;
    let status: Purchase["status"] = "received";
    if (p >= 8) status = "ordered";
    else if (p === 5 || p === 7) status = "partially_received";
    const purchase: Purchase = {
      id: `po_${p + 1}`, refNo: `PO-${String(poSeq++).padStart(5, "0")}`, date,
      supplierId: supplier.id, supplierName: supplier.name, items,
      subtotal, discount, tax: 0, total,
      paidAmount: status === "received" ? (r() < 0.6 ? total : Math.round(total * 0.5)) : 0,
      status, createdAt: date,
    };
    purchases.push(purchase);

    // Receive (fully or partially)
    if (status !== "ordered") {
      const receiveDate = addDays(date, ri(1, 3));
      const recItems: Receiving["items"] = [];
      for (const it of items) {
        const frac = status === "received" ? 1 : 0.5;
        const qty = Math.round(it.orderedQty * frac);
        it.receivedQty = qty;
        if (qty <= 0) continue;
        const med = medicines.find((m) => m.id === it.medicineId)!;
        const batch: Batch = {
          id: uid("bt"), batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate,
          purchasePrice: it.unitCost, quantity: qty, receivedDate: receiveDate,
        };
        med.batches.push(batch);
        recItems.push({ id: uid("ri"), medicineId: med.id, medicineName: med.name, batchId: batch.id, batchNo: batch.batchNo, expiryDate: batch.expiryDate, mfgDate: batch.mfgDate, quantity: qty, unitCost: it.unitCost });
        addMovement({
          date: receiveDate, type: "purchase_receive", medicineId: med.id, medicineName: med.name,
          batchId: batch.id, batchNo: batch.batchNo, qtyIn: qty, qtyOut: 0, unitCost: it.unitCost,
          refNo: purchase.refNo, note: `Received from ${supplier.name}`, userName: "Usman Tariq",
        });
      }
      const receivedTotal = recItems.reduce((s, it) => s + it.quantity * it.unitCost, 0);
      receivings.push({
        id: `rcv_${p + 1}`, receiveNo: `GRN-${String(p + 1).padStart(5, "0")}`, purchaseId: purchase.id,
        refNo: purchase.refNo, supplierId: supplier.id, supplierName: supplier.name, date: receiveDate,
        items: recItems, total: receivedTotal, receivedBy: "Usman Tariq",
      });
      // supplier payable on received goods
      supplier.openingBalance += receivedTotal;
      const paidNow = status === "received" ? (r() < 0.6 ? receivedTotal : Math.round(receivedTotal * 0.5)) : 0;
      purchase.paidAmount = paidNow;
      if (paidNow > 0) {
        addCash({
          date: receiveDate, direction: "out", category: "supplier_payment", refNo: purchase.refNo,
          description: `Payment to ${supplier.name} (${purchase.refNo})`, amount: paidNow, method: "cash",
        });
      }
    }
  }

  // ── Customers ──
  const CUSTOMERS: Array<[string, string, string, Customer["type"], number]> = [
    ["Muhammad Ali Raza", "0300-1234567", "Gulberg III, Lahore", "regular", 0],
    ["Sana Tariq", "0321-5558899", "Model Town, Lahore", "regular", 0],
    ["Dr. Khalid Mehmood", "0333-7845120", "Johar Town, Lahore", "wholesale", 50000],
    ["Ayesha Siddiqui", "0301-9982773", "DHA Phase 5, Lahore", "regular", 0],
    ["Bilal Ahmed", "0345-1122334", "Township, Lahore", "walk-in", 0],
    ["Hina Butt", "0302-6677889", "Cantt, Lahore", "regular", 0],
    ["Rashid Minhas", "0312-3456789", "Faisal Town, Lahore", "regular", 0],
    ["Fatima Zahra", "0334-9876543", "Iqbal Town, Lahore", "regular", 0],
    ["Umair Hassan", "0308-4455667", "Bahria Town, Lahore", "wholesale", 100000],
    ["Nimra Khan", "0311-2233445", "Wapda Town, Lahore", "regular", 0],
    ["Owais Sheikh", "0300-8877665", "Shadman, Lahore", "regular", 0],
    ["Mariam Nawaz", "0322-1100998", "Alma Road, Lahore", "regular", 0],
    ["Zeeshan Ali", "0347-5544332", "Green Town, Lahore", "walk-in", 0],
    ["Kiran Shahzadi", "0335-7788990", "Multan Road, Lahore", "regular", 0],
    ["Ahmed Raza Khan", "0313-6677554", "Samanabad, Lahore", "regular", 0],
    ["Dr. Sadia Anwar", "0304-9911223", "Gulshan-e-Ravi, Lahore", "wholesale", 30000],
    ["Fahad Mustafa", "0336-2211445", "Valencia, Lahore", "regular", 0],
    ["Sadia Rehman", "0310-3344556", "Muslim Town, Lahore", "regular", 0],
    ["Tahir Abbas", "0349-6655778", "Raiwind Road, Lahore", "walk-in", 0],
    ["Momina Duraid", "0305-7766554", "Lake City, Lahore", "regular", 0],
  ];
  CUSTOMERS.forEach(([name, phone, address, type, credit], i) => {
    customers.push({
      id: `cus_${i + 1}`, name, phone, address, type, creditLimit: credit,
      openingBalance: type === "wholesale" && i === 2 ? 12500 : 0,
      createdAt: addDays(today, -ri(60, 420)),
    });
  });

  // ── Sales (FEFO allocation over current batches) ──
  let invSeq = 1;
  const saleDefs: Array<{ daysAgo: number; count: number; customerId?: number; partial?: boolean }> = [
    { daysAgo: 0, count: 3 }, { daysAgo: 0, count: 1, customerId: 6 },
    { daysAgo: 1, count: 2, customerId: 1 }, { daysAgo: 2, count: 2, customerId: 3 },
    { daysAgo: 3, count: 1, customerId: 9 }, { daysAgo: 5, count: 2 },
    { daysAgo: 7, count: 1, customerId: 2 }, { daysAgo: 9, count: 1, customerId: 8, partial: true },
    { daysAgo: 12, count: 2 }, { daysAgo: 14, count: 1, customerId: 4 },
  ];
  for (const def of saleDefs) {
    for (let s = 0; s < def.count; s++) {
      const customer = def.customerId ? customers[def.customerId - 1] : pick(customers);
      const items: Sale["items"] = [];
      const lineCount = ri(1, 4);
      for (let j = 0; j < lineCount; j++) {
        const candidates = medicines.filter((m) => sellableStock(m, today) > 10);
        if (!candidates.length) break;
        const m = pick(candidates);
        const qty = Math.min(ri(1, 12), Math.floor(sellableStock(m, today) * 0.3)) || 1;
        const { allocations } = allocateFefo(m, qty, today);
        for (const a of allocations) {
          const batch = m.batches.find((b) => b.id === a.batchId)!;
          batch.quantity -= a.quantity;
          const discount = r() < 0.25 ? Math.round(a.quantity * m.retailPrice * 0.03) : 0;
          const tax = Math.round(((a.quantity * m.retailPrice - discount) * m.taxRate) / 100);
          items.push({
            id: uid("si"), medicineId: m.id, medicineName: m.name, batchId: a.batchId, batchNo: a.batchNo,
            expiryDate: a.expiryDate, quantity: a.quantity, unitPrice: m.retailPrice, costPrice: a.unitCost,
            discount, taxRate: m.taxRate, total: a.quantity * m.retailPrice - discount + tax,
          });
          addMovement({
            date: addDays(today, -def.daysAgo), type: "sale", medicineId: m.id, medicineName: m.name,
            batchId: a.batchId, batchNo: a.batchNo, qtyIn: 0, qtyOut: a.quantity, unitCost: a.unitCost,
            refNo: `INV-${String(invSeq).padStart(5, "0")}`, note: `Sold to ${customer.name}`, userName: "Fatima Zahra",
          });
        }
      }
      if (!items.length) continue;
      const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      const itemDiscountTotal = items.reduce((s, it) => s + it.discount, 0);
      const invoiceDiscount = r() < 0.15 ? Math.round(subtotal * 0.02) : 0;
      const taxTotal = items.reduce((s, it) => s + it.taxRate / 100 * (it.quantity * it.unitPrice - it.discount), 0);
      const total = subtotal - itemDiscountTotal - invoiceDiscount + Math.round(taxTotal);
      const methods: Sale["paymentMethod"][] = ["cash", "cash", "card", "mobile_wallet", "cash"];
      const method = pick(methods);
      const paid = def.partial ? Math.round(total * 0.5) : total;
      const saleDateISO = new Date(`${addDays(today, -def.daysAgo)}T${String(ri(9, 20)).padStart(2, "0")}:${String(ri(0, 59)).padStart(2, "0")}:00`).toISOString();
      const sale: Sale = {
        id: `sale_${invSeq}`, invoiceNo: `INV-${String(invSeq).padStart(5, "0")}`,
        date: saleDateISO,
        customerId: customer.id, customerName: customer.name,
        items, itemDiscountTotal, invoiceDiscount, taxTotal: Math.round(taxTotal), subtotal,
        total, paidAmount: paid, changeReturned: 0,
        paymentMethod: method, status: "completed", cashierName: "Fatima Zahra",
      };
      sales.push(sale);
      if (method === "cash" || method === "card") {
        addCash({
          date: saleDateISO.slice(0, 10), direction: "in", category: "sale", refNo: sale.invoiceNo,
          description: `Sale ${sale.invoiceNo} — ${customer.name}`, amount: paid, method,
        });
      }
      invSeq++;
    }
  }

  // ── A sales return (restock) ──
  const saleR = sales[3];
  if (saleR && saleR.items[0]) {
    const si = saleR.items[0];
    const med = medicines.find((m) => m.id === si.medicineId)!;
    const batch = med.batches.find((b) => b.id === si.batchId);
    const qty = Math.min(2, si.quantity);
    if (batch && batch.expiryDate >= today) {
      batch.quantity += qty;
      saleR.status = "partially_returned";
      movements.push({
        id: uid("mv"), date: today, type: "sale_return", medicineId: med.id, medicineName: med.name,
        batchId: batch.id, batchNo: batch.batchNo, qtyIn: qty, qtyOut: 0, unitCost: si.costPrice,
        refNo: "SR-00001", note: `Restocked from return of ${saleR.invoiceNo}`, userName: "Ayesha Khan",
      });
    }
  }

  // ── Issuances (damaged / expired) ──
  const expMed = medicines.find((m) => m.batches.some((b) => b.expiryDate < today && b.quantity > 0))!;
  const expBatch = expMed.batches.find((b) => b.expiryDate < today && b.quantity > 0)!;
  const issueQty = Math.min(10, expBatch.quantity);
  expBatch.quantity -= issueQty;
  issuances.push({
    id: "iss_1", voucherNo: "ISS-00001", date: addDays(today, -4), destination: "Main Store",
    reason: "expired", authorizedBy: "Ayesha Khan",
    items: [{ id: uid("ii"), medicineId: expMed.id, medicineName: expMed.name, batchId: expBatch.id, batchNo: expBatch.batchNo, quantity: issueQty, unitCost: expBatch.purchasePrice }],
    totalValue: issueQty * expBatch.purchasePrice, notes: "Expired stock quarantined for disposal",
  });
  movements.push({
    id: uid("mv"), date: addDays(today, -4), type: "expiry_removal", medicineId: expMed.id, medicineName: expMed.name,
    batchId: expBatch.id, batchNo: expBatch.batchNo, qtyIn: 0, qtyOut: issueQty, unitCost: expBatch.purchasePrice,
    refNo: "ISS-00001", note: "Expired stock removed", userName: "Usman Tariq",
  });

  // ── Expenses ──
  const EXPENSES: Array<[Expense["category"], number, string, number]> = [
    ["rent", 85000, "Monthly shop rent — Gulberg III", 26],
    ["salaries", 185000, "Staff salaries — 4 employees", 24],
    ["electricity", 24350, "LESCO bill", 19],
    ["transportation", 6800, "Delivery van fuel", 15],
    ["maintenance", 12500, "AC service + cold-chain fridge checkup", 11],
    ["marketing", 8000, "Signage and flyers", 8],
    ["rent", 85000, "Monthly shop rent", -4],
    ["salaries", 185000, "Staff salaries", -6],
    ["other", 3200, "Cleaning supplies", -2],
  ];
  EXPENSES.forEach(([category, amount, description, daysAgo], i) => {
    expenses.push({
      id: `exp_${i + 1}`, expenseNo: `EXP-${String(i + 1).padStart(5, "0")}`,
      date: addDays(today, -daysAgo), category, amount, description, method: "cash", recordedBy: "Ayesha Khan",
    });
    addCash({ date: addDays(today, -daysAgo), direction: "out", category: "expense", refNo: `EXP-${String(i + 1).padStart(5, "0")}`, description, amount, method: "cash" });
  });

  // ── Staff users ──
  const users: StaffUser[] = [
    { id: "usr_1", name: "Ayesha Khan", username: "admin", role: "administrator", phone: "0300-1112223", active: true, createdAt: addDays(today, -500) },
    { id: "usr_2", name: "Dr. Bilal Ahmed", username: "pharmacist", role: "pharmacist", phone: "0321-9988776", active: true, createdAt: addDays(today, -420) },
    { id: "usr_3", name: "Fatima Zahra", username: "cashier", role: "cashier", phone: "0333-5566778", active: true, createdAt: addDays(today, -300) },
    { id: "usr_4", name: "Usman Tariq", username: "stock", role: "inventory_manager", phone: "0345-4433221", active: true, createdAt: addDays(today, -260) },
  ];
  activityLog.push(
    { id: uid("log"), userId: "usr_1", userName: "Ayesha Khan", action: "login", detail: "Signed in (demo)", date: new Date().toISOString() },
    { id: uid("log"), userId: "usr_4", userName: "Usman Tariq", action: "receive", detail: "Goods receiving GRN-00001 verified", date: addDays(today, -1) },
  );

  return {
    medicines, suppliers, customers, sales, purchases, receivings, issuances,
    transfers: [], salesReturns: [], purchaseReturns: [],
    supplierPayments: [], customerPayments: [], expenses, movements, cashEntries,
    users, activityLog,
    settings: {
      pharmacyName: "MediCore Pharmacy",
      logoText: "M",
      address: "Shop 14-C, Main Boulevard, Gulberg III, Lahore, Punjab",
      phone: "042-35871234",
      email: "care@medicorepharmacy.pk",
      licenseNo: "DRAP-LHR-2024-0917",
      currency: "Rs.",
      currencyCode: "PKR",
      defaultTaxRate: 0.5,
      lowStockThreshold: 25,
      expiryWarnDays: 90,
      invoiceFooter: "Medicines are non-returnable after 7 days. Please check batch & expiry at purchase. Thank you for your visit!",
      receiptWidth: "thermal80",
      showLogoOnReceipt: true,
      branchName: "Main Branch — Lahore",
      storageLocations: ["Main Store", "Cold Storage", "Shelf Section A", "Shelf Section B", "Warehouse"],
    },
    currentUser: null,
    _seq: 1000,
    _version: 1,
    demoCleared: false,
  };
}
