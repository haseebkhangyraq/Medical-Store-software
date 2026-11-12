"use client";

import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Pencil, Trash2, Upload, Download, Pill, Boxes, History, Layers, Eye,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Select, Textarea, Badge, Modal, Field, EmptyState, PageHeader, SearchInput, TableWrap, Th, Td, ConfirmDialog, Tabs, StatCard } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatCurrency, formatDate, downloadCSV, cn, daysUntil } from "@/lib/utils";
import { sellableStock, totalStock, stockValue, liveBatches, expiryStatus } from "@/lib/stock";
import type { Medicine, MedicineCategory, Batch } from "@/lib/types";

const CATEGORIES: MedicineCategory[] = ["Tablet", "Syrup", "Capsule", "Injection", "Ointment", "Drops", "Suspension", "Sachet", "Inhaler", "Suppository"];

const emptyForm = {
  name: "", genericName: "", brandName: "", category: "Tablet" as MedicineCategory, manufacturer: "",
  supplierId: "", unitType: "Strip of 10", rackLocation: "", prescriptionRequired: false,
  minStockLevel: 20, retailPrice: 0, wholesalePrice: 0, taxRate: 0.5, description: "",
  barcode: "", sku: "",
};

const emptyBatch = { batchNo: "", mfgDate: "", expiryDate: "", purchasePrice: 0, quantity: 0 };

export default function MedicinesPage() {
  return (
    <Suspense>
      <MedicinesInner />
    </Suspense>
  );
}

function MedicinesInner() {
  const store = useStore();
  const medicines = useStore((s) => s.medicines);
  const suppliers = useStore((s) => s.suppliers);
  const settings = useStore((s) => s.settings);
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusId = searchParams.get("focus");

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [mfr, setMfr] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [firstBatch, setFirstBatch] = useState({ ...emptyBatch });
  const [detail, setDetail] = useState<Medicine | null>(null);
  const [detailTab, setDetailTab] = useState("batches");
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);
  const [newBatch, setNewBatch] = useState({ ...emptyBatch });
  const [adjustOpen, setAdjustOpen] = useState<Batch | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  const cur = settings.currency;
  const fmt = (n: number) => formatCurrency(n, cur);
  const today = new Date().toISOString().slice(0, 10);

  const manufacturers = useMemo(() => [...new Set(medicines.map((m) => m.manufacturer))].sort(), [medicines]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = medicines.filter((m) => {
      if (cat !== "all" && m.category !== cat) return false;
      if (mfr !== "all" && m.manufacturer !== mfr) return false;
      if (query && !(m.name.toLowerCase().includes(query) || m.genericName.toLowerCase().includes(query) || m.sku.toLowerCase().includes(query) || m.barcode.includes(query))) return false;
      const stock = sellableStock(m, today);
      if (stockFilter === "out" && stock > 0) return false;
      if (stockFilter === "low" && !(stock > 0 && stock <= Math.max(m.minStockLevel, settings.lowStockThreshold))) return false;
      if (stockFilter === "ok" && stock <= Math.max(m.minStockLevel, settings.lowStockThreshold)) return false;
      if (expiryFilter !== "all") {
        const statuses = m.batches.filter((b) => b.quantity > 0).map((b) => expiryStatus(b.expiryDate, settings.expiryWarnDays, today));
        if (expiryFilter === "expired" && !statuses.includes("expired")) return false;
        if (expiryFilter === "critical" && !statuses.includes("critical")) return false;
        if (expiryFilter === "warning" && !(statuses.includes("critical") || statuses.includes("warning"))) return false;
      }
      return true;
    });
    const sorters: Record<string, (a: Medicine, b: Medicine) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      stock_asc: (a, b) => sellableStock(a, today) - sellableStock(b, today),
      stock_desc: (a, b) => sellableStock(b, today) - sellableStock(a, today),
      expiry: (a, b) => {
        const ea = liveBatches(a, today)[0]?.expiryDate ?? "9999";
        const eb = liveBatches(b, today)[0]?.expiryDate ?? "9999";
        return ea.localeCompare(eb);
      },
      value: (a, b) => stockValue(b) - stockValue(a),
    };
    list = [...list].sort(sorters[sort] ?? sorters.name);
    return list;
  }, [medicines, q, cat, mfr, stockFilter, expiryFilter, sort, settings.lowStockThreshold, settings.expiryWarnDays, today]);

  const totals = useMemo(() => ({
    count: medicines.length,
    value: medicines.reduce((s, m) => s + stockValue(m), 0),
    low: medicines.filter((m) => sellableStock(m, today) <= Math.max(m.minStockLevel, settings.lowStockThreshold)).length,
  }), [medicines, settings.lowStockThreshold, today]);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, supplierId: suppliers[0]?.id ?? "", sku: `MED-${String(medicines.length + 1).padStart(4, "0")}`, barcode: String(Math.floor(Math.random() * 9e9) + 1e9) });
    setFirstBatch({ ...emptyBatch });
    setFormOpen(true);
  }

  function openEdit(m: Medicine) {
    setEditing(m);
    setForm({
      name: m.name, genericName: m.genericName, brandName: m.brandName, category: m.category,
      manufacturer: m.manufacturer, supplierId: m.supplierId, unitType: m.unitType,
      rackLocation: m.rackLocation, prescriptionRequired: m.prescriptionRequired,
      minStockLevel: m.minStockLevel, retailPrice: m.retailPrice, wholesalePrice: m.wholesalePrice,
      taxRate: m.taxRate, description: m.description, barcode: m.barcode, sku: m.sku,
    });
    setFormOpen(true);
  }

  function saveForm() {
    if (!form.name.trim()) { toast.error("Medicine name is required"); return; }
    if (!editing && form.retailPrice <= 0) { toast.error("Retail price must be greater than 0"); return; }
    if (editing) {
      store.updateMedicine(editing.id, form);
      toast.success("Medicine updated", form.name);
    } else {
      const batchValid = firstBatch.batchNo && firstBatch.expiryDate && firstBatch.quantity > 0;
      if (batchValid && firstBatch.expiryDate < today) {
        toast.error("Invalid batch", "Expiry date cannot be in the past");
        return;
      }
      store.addMedicine(
        { ...form, supplierId: form.supplierId || suppliers[0]?.id || "" },
        batchValid ? { ...firstBatch, purchasePrice: Number(firstBatch.purchasePrice) || 0 } : undefined
      );
      toast.success("Medicine added", `${form.name}${batchValid ? " with opening batch" : ""}`);
    }
    setFormOpen(false);
  }

  function exportCSV() {
    downloadCSV("medicines", rows.map((m) => ({
      SKU: m.sku, Barcode: m.barcode, Name: m.name, Generic: m.genericName, Brand: m.brandName,
      Category: m.category, Manufacturer: m.manufacturer, Unit: m.unitType,
      "Sellable Stock": sellableStock(m, today), "Total Stock": totalStock(m),
      "Min Level": m.minStockLevel, "Retail Price": m.retailPrice, "Wholesale": m.wholesalePrice,
      "Stock Value": Math.round(stockValue(m)), "Rack": m.rackLocation, "Rx": m.prescriptionRequired ? "Yes" : "No",
      Batches: m.batches.map((b) => `${b.batchNo}(exp ${b.expiryDate.slice(0, 10)}, qty ${b.quantity})`).join("; "),
    })));
    toast.success("Exported", `${rows.length} medicines exported to CSV`);
  }

  function importCSV(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(",").map((h) => h.trim());
        const idx = (h: string) => headers.indexOf(h);
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          // naive CSV split (no quoted commas expected in export format without quotes)
          const cells = lines[i].split(",").map((c) => c.trim());
          const name = cells[idx("Name")] ?? "";
          if (!name) continue;
          const num = (h: string) => Number(cells[idx(h)]) || 0;
          store.addMedicine({
            name, genericName: cells[idx("Generic")] ?? "", brandName: cells[idx("Brand")] ?? "",
            category: (cells[idx("Category")] as MedicineCategory) || "Tablet",
            manufacturer: cells[idx("Manufacturer")] ?? "", supplierId: suppliers[0]?.id ?? "",
            unitType: cells[idx("Unit")] || "Strip of 10", rackLocation: cells[idx("Rack")] ?? "",
            prescriptionRequired: (cells[idx("Rx")] ?? "").toLowerCase() === "yes",
            minStockLevel: num("Min Level"), retailPrice: num("Retail Price"), wholesalePrice: num("Wholesale"),
            taxRate: 0.5, description: "", barcode: String(Math.floor(Math.random() * 9e9) + 1e9),
            sku: cells[idx("SKU")] || `MED-${String(medicines.length + count + 1).padStart(4, "0")}`,
          });
          count++;
        }
        toast.success("Import complete", `${count} medicines added from CSV`);
      } catch {
        toast.error("Import failed", "Could not parse the CSV file");
      }
    };
    reader.readAsText(file);
  }

  const detailMed = detail ? medicines.find((m) => m.id === detail.id) ?? detail : null;

  return (
    <div>
      <PageHeader
        title="Medicines" subtitle={`${medicines.length} products · batch-based inventory`}
        actions={
          <>
            <label className="inline-flex">
              <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])} />
              <Button variant="outline" size="sm" onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement)?.click()}><Upload className="h-4 w-4" /> Import</Button>
            </label>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4" /> Export</Button>
            <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> Add Medicine</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Products" value={String(totals.count)} icon={<Pill className="h-5 w-5" />} tone="navy" />
        <StatCard label="Inventory Value" value={fmt(totals.value)} icon={<Boxes className="h-5 w-5" />} tone="violet" />
        <StatCard label="Low / Out of Stock" value={String(totals.low)} icon={<Boxes className="h-5 w-5" />} tone="red" />
        <StatCard label="Batches" value={String(medicines.reduce((s, m) => s + m.batches.length, 0))} icon={<Layers className="h-5 w-5" />} tone="blue" />
      </div>

      <Card className="mb-4 p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="col-span-2" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={mfr} onChange={(e) => setMfr(e.target.value)}>
            <option value="all">All manufacturers</option>
            {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="all">All stock</option>
            <option value="ok">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
          <Select value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
            <option value="all">Any expiry</option>
            <option value="expired">Has expired batch</option>
            <option value="critical">Expiring ≤ 30 days</option>
            <option value="warning">Expiring ≤ 60 days</option>
          </Select>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          Sort:
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 w-44 text-xs">
            <option value="name">Name A→Z</option>
            <option value="stock_asc">Stock low→high</option>
            <option value="stock_desc">Stock high→low</option>
            <option value="expiry">Earliest expiry</option>
            <option value="value">Inventory value</option>
          </Select>
        </div>
      </Card>

      <Card>
        <TableWrap>
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <Th>Medicine</Th><Th>Generic / Brand</Th><Th>Category</Th><Th>Manufacturer</Th>
                <Th className="text-right">Retail</Th><Th className="text-right">Sellable</Th><Th>Next Expiry</Th><Th>SKU</Th><Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const stock = sellableStock(m, today);
                const next = liveBatches(m, today)[0];
                const nextAll = [...m.batches].filter((b) => b.quantity > 0).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
                return (
                  <tr key={m.id} className={cn(focusId === m.id && "bg-amber-50/60")}>
                    <Td>
                      <div className="flex items-center gap-2">
                        {m.prescriptionRequired && <Badge tone="violet">Rx</Badge>}
                        <span className="font-medium text-slate-800">{m.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{m.rackLocation} · {m.unitType}</div>
                    </Td>
                    <Td><div>{m.genericName}</div><div className="text-[11px] text-slate-400">{m.brandName}</div></Td>
                    <Td><Badge tone="slate">{m.category}</Badge></Td>
                    <Td>{m.manufacturer}</Td>
                    <Td className="text-right font-semibold">{fmt(m.retailPrice)}</Td>
                    <Td className="text-right">
                      <span className={cn("font-semibold", stock === 0 ? "text-rose-600" : stock <= Math.max(m.minStockLevel, settings.lowStockThreshold) ? "text-amber-600" : "text-slate-700")}>
                        {stock}
                      </span>
                      <div className="text-[10px] text-slate-400">min {m.minStockLevel}</div>
                    </Td>
                    <Td>
                      {nextAll ? (
                        <>
                          {formatDate(nextAll.expiryDate)}
                          {(() => {
                            const st = expiryStatus(nextAll.expiryDate, settings.expiryWarnDays, today);
                            if (st === "expired") return <Badge tone="red" className="ml-1.5">Expired</Badge>;
                            if (st === "critical") return <Badge tone="amber" className="ml-1.5">Soon</Badge>;
                            return null;
                          })()}
                        </>
                      ) : "—"}
                      {next ? <div className="text-[10px] text-slate-400">sellable: {next.batchNo}</div> : <div className="text-[10px] text-rose-400">no sellable batch</div>}
                    </Td>
                    <Td className="font-mono text-[11px] text-slate-500">{m.sku}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="View details" onClick={() => { setDetail(m); setDetailTab("batches"); }}><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-rose-500 hover:bg-rose-50" title="Delete" onClick={() => setDeleteTarget(m)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {!rows.length && <tr><Td colSpan={9}><EmptyState title="No medicines match your filters" message="Adjust filters or add a new medicine." action={<Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> Add Medicine</Button>} /></Td></tr>}
            </tbody>
          </table>
        </TableWrap>
        <div className="px-4 py-2.5 text-xs text-slate-400">Showing {rows.length} of {medicines.length} medicines</div>
      </Card>

      {/* Add/Edit modal */}
      <Modal
        open={formOpen} onClose={() => setFormOpen(false)}
        title={editing ? `Edit Medicine — ${editing.name}` : "Add New Medicine"}
        subtitle="Batch-level expiry & purchase cost are always preserved"
        size="lg"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={saveForm}>{editing ? "Save Changes" : "Add Medicine"}</Button></div>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Medicine Name" required className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Panamol 500mg Tablet" /></Field>
          <Field label="Generic Name"><Input value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} /></Field>
          <Field label="Brand Name"><Input value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MedicineCategory })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Manufacturer"><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></Field>
          <Field label="Supplier">
            <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">— Select supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Unit Type"><Input value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value })} placeholder="Strip of 10 / Bottle / Vial" /></Field>
          <Field label="Rack / Shelf"><Input value={form.rackLocation} onChange={(e) => setForm({ ...form, rackLocation: e.target.value })} /></Field>
          <Field label="SKU / Product Code"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Barcode"><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
          <Field label="Retail Price (Rs.)" required><Input type="number" value={form.retailPrice || ""} onChange={(e) => setForm({ ...form, retailPrice: Number(e.target.value) || 0 })} /></Field>
          <Field label="Wholesale Price (Rs.)"><Input type="number" value={form.wholesalePrice || ""} onChange={(e) => setForm({ ...form, wholesalePrice: Number(e.target.value) || 0 })} /></Field>
          <Field label="Tax Rate (%)"><Input type="number" step="0.1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) || 0 })} /></Field>
          <Field label="Min Stock Level"><Input type="number" value={form.minStockLevel} onChange={(e) => setForm({ ...form, minStockLevel: Number(e.target.value) || 0 })} /></Field>
          <Field label="Prescription Required?">
            <Select value={form.prescriptionRequired ? "yes" : "no"} onChange={(e) => setForm({ ...form, prescriptionRequired: e.target.value === "yes" })}>
              <option value="no">No — OTC</option>
              <option value="yes">Yes — Rx only</option>
            </Select>
          </Field>
          <Field label="Description" className="col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Storage instructions, composition notes…" /></Field>
        </div>

        {!editing && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><Layers className="h-3.5 w-3.5" /> Opening batch (optional — recommended)</div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              <Field label="Batch #"><Input value={firstBatch.batchNo} onChange={(e) => setFirstBatch({ ...firstBatch, batchNo: e.target.value })} placeholder="B2401-01" /></Field>
              <Field label="Mfg Date"><Input type="date" value={firstBatch.mfgDate} onChange={(e) => setFirstBatch({ ...firstBatch, mfgDate: e.target.value })} /></Field>
              <Field label="Expiry Date"><Input type="date" value={firstBatch.expiryDate} onChange={(e) => setFirstBatch({ ...firstBatch, expiryDate: e.target.value })} /></Field>
              <Field label="Purchase Price"><Input type="number" value={firstBatch.purchasePrice || ""} onChange={(e) => setFirstBatch({ ...firstBatch, purchasePrice: Number(e.target.value) || 0 })} /></Field>
              <Field label="Quantity"><Input type="number" value={firstBatch.quantity || ""} onChange={(e) => setFirstBatch({ ...firstBatch, quantity: Number(e.target.value) || 0 })} /></Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detailMed} onClose={() => setDetail(null)} title={detailMed?.name ?? ""} subtitle={detailMed ? `${detailMed.genericName} · ${detailMed.manufacturer} · SKU ${detailMed.sku}` : ""} size="lg">
        {detailMed && (
          <div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
              <Info label="Retail Price" value={fmt(detailMed.retailPrice)} />
              <Info label="Wholesale" value={fmt(detailMed.wholesalePrice)} />
              <Info label="Sellable Stock" value={`${sellableStock(detailMed, today)} ${detailMed.unitType}`} />
              <Info label="Stock Value" value={fmt(stockValue(detailMed))} />
              <Info label="Total Stock (incl. expired)" value={String(totalStock(detailMed))} />
              <Info label="Barcode" value={detailMed.barcode} />
              <Info label="Rx Required" value={detailMed.prescriptionRequired ? "Yes" : "No"} />
              <Info label="Rack" value={detailMed.rackLocation || "—"} />
            </div>
            <Tabs active={detailTab} onChange={setDetailTab} className="mb-3"
              tabs={[{ id: "batches", label: "Batch Stock", count: detailMed.batches.length }, { id: "history", label: "Movement History" }, { id: "info", label: "Details" }]} />

            {detailTab === "batches" && (
              <div>
                <TableWrap>
                  <table className="w-full min-w-[600px]">
                    <thead><tr><Th>Batch #</Th><Th>Mfg</Th><Th>Expiry</Th><Th className="text-right">Cost</Th><Th className="text-right">Qty</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
                    <tbody>
                      {[...detailMed.batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).map((b) => {
                        const st = expiryStatus(b.expiryDate, settings.expiryWarnDays, today);
                        return (
                          <tr key={b.id}>
                            <Td className="font-mono text-[12px]">{b.batchNo}</Td>
                            <Td>{b.mfgDate ? formatDate(b.mfgDate) : "—"}</Td>
                            <Td>{formatDate(b.expiryDate)}</Td>
                            <Td className="text-right">{fmt(b.purchasePrice)}</Td>
                            <Td className="text-right font-semibold">{b.quantity}</Td>
                            <Td>
                              {st === "expired" ? <Badge tone="red">Expired</Badge> :
                               st === "critical" ? <Badge tone="amber">{daysUntil(b.expiryDate)}d left</Badge> :
                               st === "warning" ? <Badge tone="blue">{daysUntil(b.expiryDate)}d left</Badge> :
                               b.quantity === 0 ? <Badge tone="slate">Depleted</Badge> : <Badge tone="green">Good</Badge>}
                            </Td>
                            <Td className="text-right">
                              <div className="flex justify-end gap-1">
                                {b.quantity > 0 && (
                                  <Button size="sm" variant="secondary" onClick={() => { setAdjustOpen(b); setAdjustQty(b.quantity); setAdjustReason(""); }}>Adjust</Button>
                                )}
                                {st === "expired" && b.quantity > 0 && (
                                  <Button size="sm" variant="danger" onClick={() => {
                                    store.removeExpiredBatch(detailMed.id, b.id, "Expired batch removed from shelf");
                                    toast.success("Expired stock removed", `${b.batchNo} — qty set to 0, ledger recorded`);
                                  }}>Remove</Button>
                                )}
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-600">Add new batch</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Field label="Batch #"><Input value={newBatch.batchNo} onChange={(e) => setNewBatch({ ...newBatch, batchNo: e.target.value })} /></Field>
                    <Field label="Mfg"><Input type="date" value={newBatch.mfgDate} onChange={(e) => setNewBatch({ ...newBatch, mfgDate: e.target.value })} /></Field>
                    <Field label="Expiry"><Input type="date" value={newBatch.expiryDate} onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })} /></Field>
                    <Field label="Cost"><Input type="number" value={newBatch.purchasePrice || ""} onChange={(e) => setNewBatch({ ...newBatch, purchasePrice: Number(e.target.value) || 0 })} /></Field>
                    <Field label="Qty"><Input type="number" value={newBatch.quantity || ""} onChange={(e) => setNewBatch({ ...newBatch, quantity: Number(e.target.value) || 0 })} /></Field>
                  </div>
                  <Button size="sm" className="mt-2" onClick={() => {
                    if (!newBatch.batchNo || !newBatch.expiryDate || newBatch.quantity <= 0) { toast.error("Fill batch number, expiry and quantity"); return; }
                    if (newBatch.expiryDate < today) { toast.error("Expiry date cannot be in the past"); return; }
                    store.addBatch(detailMed.id, { ...newBatch, purchasePrice: Number(newBatch.purchasePrice) || 0 });
                    setNewBatch({ ...emptyBatch });
                    toast.success("Batch added");
                  }}><Plus className="h-3.5 w-3.5" /> Add Batch</Button>
                </div>
              </div>
            )}

            {detailTab === "history" && (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {store.movements.filter((mv) => mv.medicineId === detailMed.id).slice(0, 40).map((mv) => (
                  <div key={mv.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
                    <div>
                      <div className="font-medium text-slate-700">{mv.type.replace("_", " ")} · {mv.refNo}</div>
                      <div className="text-slate-400">{mv.batchNo} · {formatDate(mv.date)} · {mv.note}</div>
                    </div>
                    <span className={cn("font-bold", mv.qtyIn > 0 ? "text-emerald-600" : "text-rose-600")}>
                      {mv.qtyIn > 0 ? `+${mv.qtyIn}` : `−${mv.qtyOut}`}
                    </span>
                  </div>
                ))}
                {!store.movements.some((mv) => mv.medicineId === detailMed.id) && <EmptyState icon={<History className="h-6 w-6" />} title="No movements recorded" />}
              </div>
            )}

            {detailTab === "info" && (
              <div className="space-y-2 text-[13px] text-slate-600">
                <p><span className="font-medium text-slate-700">Description:</span> {detailMed.description || "—"}</p>
                <p><span className="font-medium text-slate-700">Supplier:</span> {suppliers.find((x) => x.id === detailMed.supplierId)?.name ?? "—"}</p>
                <p><span className="font-medium text-slate-700">Tax Rate:</span> {detailMed.taxRate}%</p>
                <p><span className="font-medium text-slate-700">Created:</span> {formatDate(detailMed.createdAt.slice(0, 10))}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Adjust modal */}
      <Modal open={!!adjustOpen} onClose={() => setAdjustOpen(null)} title="Adjust Batch Quantity" size="sm"
        subtitle={adjustOpen ? `Batch ${adjustOpen.batchNo} · current ${adjustOpen.quantity}` : ""}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setAdjustOpen(null)}>Cancel</Button>
          <Button onClick={() => {
            if (!adjustOpen) return;
            if (adjustQty < 0) { toast.error("Quantity cannot be negative"); return; }
            store.adjustBatch(detailMed!.id, adjustOpen.id, adjustQty, adjustReason || "Manual adjustment");
            toast.success("Stock adjusted", `${adjustOpen.batchNo} → ${adjustQty}`);
            setAdjustOpen(null);
          }}>Apply Adjustment</Button></div>}>
        <div className="space-y-3">
          <Field label="New Quantity" required><Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(Number(e.target.value))} /></Field>
          <Field label="Reason"><Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. Physical count correction, breakage" /></Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger
        title="Delete medicine?" confirmLabel="Delete"
        message={`Delete "${deleteTarget?.name}" and all its batch records? This cannot be undone (sales history is preserved).`}
        onConfirm={() => {
          if (deleteTarget) {
            store.deleteMedicine(deleteTarget.id);
            toast.success("Medicine deleted", deleteTarget.name);
          }
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate font-semibold text-slate-700">{value}</div>
    </div>
  );
}
