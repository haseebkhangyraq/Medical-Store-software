"use client";

import { useRef, useState } from "react";
import { Settings as SettingsIcon, Save, DatabaseZap, Download, Upload, Store, Palette, ReceiptText, Calculator, RefreshCcw, Trash2, Check, Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardHeader, Button, Input, Select, Badge, Field, PageHeader, Textarea, StatCard, ConfirmDialog, Alert, Tabs } from "@/components/ui";
import { printModuleReport } from "@/components/module-print";
import { toast } from "@/components/toast";
import { formatCurrency } from "@/lib/utils";
import type { PharmacySettings } from "@/lib/types";

export default function SettingsPage() {
  const store = useStore();
  const s = useStore();
  const settings = s.settings;
  const [tab, setTab] = useState("store");
  const [form, setForm] = useState<PharmacySettings>({ ...settings });
  const [saved, setSaved] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  function save() {
    store.updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    toast.success("Settings saved", "Applied across the application");
  }

  function exportBackup() {
    const data = {
      exportedAt: new Date().toISOString(),
      version: 1,
      medicines: s.medicines, suppliers: s.suppliers, customers: s.customers,
      sales: s.sales, purchases: s.purchases, receivings: s.receivings, issuances: s.issuances,
      transfers: s.transfers, salesReturns: s.salesReturns, purchaseReturns: s.purchaseReturns,
      supplierPayments: s.supplierPayments, customerPayments: s.customerPayments,
      expenses: s.expenses, movements: s.movements, cashEntries: s.cashEntries,
      users: s.users, activityLog: s.activityLog, settings: s.settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `medicore-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast.success("Backup downloaded");
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data.medicines || !data.settings) throw new Error("bad file");
        store.updateSettings(data.settings);
        useStore.setState({
          medicines: data.medicines, suppliers: data.suppliers ?? [], customers: data.customers ?? [],
          sales: data.sales ?? [], purchases: data.purchases ?? [], receivings: data.receivings ?? [],
          issuances: data.issuances ?? [], transfers: data.transfers ?? [], salesReturns: data.salesReturns ?? [],
          purchaseReturns: data.purchaseReturns ?? [], supplierPayments: data.supplierPayments ?? [],
          customerPayments: data.customerPayments ?? [], expenses: data.expenses ?? [],
          movements: data.movements ?? [], cashEntries: data.cashEntries ?? [],
          users: data.users ?? useStore.getState().users, activityLog: data.activityLog ?? [],
        });
        toast.success("Backup restored", "All data replaced from the backup file");
      } catch {
        toast.error("Restore failed", "Invalid backup file");
      }
    };
    reader.readAsText(file);
  }

  function printSummary() {
    printModuleReport({
      title: "System Configuration",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      branchName: settings.branchName,
      kpis: [
        ["Currency", `${settings.currency} (${settings.currencyCode})`],
        ["Low Stock Threshold", String(settings.lowStockThreshold)],
        ["Expiry Warning", `${settings.expiryWarnDays} days`],
        ["Storage Locations", String(settings.storageLocations.length)],
      ],
      sections: [{
        heading: "Store Profile & Billing Configuration",
        columns: ["Setting", "Value"],
        rows: [
          ["Pharmacy name", settings.pharmacyName],
          ["Branch", settings.branchName || "—"],
          ["Address", settings.address || "—"],
          ["Email", settings.email || "—"],
          ["License no.", settings.licenseNo || "—"],
          ["Default tax rate", `${settings.defaultTaxRate}%`],
          ["Receipt style", settings.receiptWidth === "thermal80" ? "Thermal 80mm" : "A4"],
          ["Low stock threshold", String(settings.lowStockThreshold)],
          ["Expiry warning (days)", String(settings.expiryWarnDays)],
          ["Storage locations", settings.storageLocations.join(", ")],
        ],
      }],
      note: "Configuration snapshot — changes are saved through the Settings page.",
    });
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Pharmacy profile, billing configuration, data tools"
        actions={<>
          <Button variant="outline" size="sm" onClick={printSummary}><Printer className="h-4 w-4" /> Print Summary</Button>
          <Button size="sm" onClick={save} variant={saved ? "success" : "primary"}>{saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} {saved ? "Saved" : "Save Changes"}</Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pharmacy" value={settings.pharmacyName} icon={<Store className="h-5 w-5" />} tone="navy" />
        <StatCard label="Currency" value={`${settings.currency} (${settings.currencyCode})`} icon={<Calculator className="h-5 w-5" />} tone="green" />
        <StatCard label="Low Stock Threshold" value={String(settings.lowStockThreshold)} icon={<Store className="h-5 w-5" />} tone="amber" />
        <StatCard label="Expiry Warning" value={`${settings.expiryWarnDays} days`} icon={<RefreshCcw className="h-5 w-5" />} tone="red" />
      </div>

      <Tabs active={tab} onChange={setTab} className="mb-4"
        tabs={[{ id: "store", label: "Store Profile" }, { id: "billing", label: "Billing & Tax" }, { id: "theme", label: "Preferences" }, { id: "data", label: "Data & Backup" }]} />

      {tab === "store" && (
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4 md:col-span-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-2xl font-black text-white">{settings.logoText || "M"}</div>
              <div className="flex-1">
                <Field label="Pharmacy Name" required><Input value={form.pharmacyName} onChange={(e) => setForm({ ...form, pharmacyName: e.target.value })} /></Field>
              </div>
              <div className="w-20">
                <Field label="Logo Letter"><Input maxLength={2} value={form.logoText} onChange={(e) => setForm({ ...form, logoText: e.target.value })} /></Field>
              </div>
            </div>
            <Field label="Branch Name"><Input value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} /></Field>
            <Field label="DRAP / Drug License #"><Input value={form.licenseNo} onChange={(e) => setForm({ ...form, licenseNo: e.target.value })} /></Field>
            <Field label="Address"><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Storage Locations (comma separated)" className="md:col-span-2">
              <Input value={form.storageLocations.join(", ")} onChange={(e) => setForm({ ...form, storageLocations: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
            </Field>
          </div>
        </Card>
      )}

      {tab === "billing" && (
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Currency Symbol"><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Currency Code"><Input value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })} /></Field>
            <Field label="Default Tax Rate (%)"><Input type="number" step="0.1" value={form.defaultTaxRate} onChange={(e) => setForm({ ...form, defaultTaxRate: Number(e.target.value) || 0 })} /></Field>
            <Field label="Low Stock Threshold (units)"><Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) || 0 })} /></Field>
            <Field label="Expiry Warning Period (days)"><Input type="number" value={form.expiryWarnDays} onChange={(e) => setForm({ ...form, expiryWarnDays: Number(e.target.value) || 0 })} /></Field>
            <Field label="Default Receipt Format">
              <Select value={form.receiptWidth} onChange={(e) => setForm({ ...form, receiptWidth: e.target.value as PharmacySettings["receiptWidth"] })}>
                <option value="thermal80">Thermal 80mm</option>
                <option value="a4">A4 Invoice</option>
              </Select>
            </Field>
            <Field label="Invoice Footer (printed on receipts)" className="md:col-span-2">
              <Textarea value={form.invoiceFooter} onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <div className="mb-2 font-semibold text-slate-700">Preview</div>
            <div className="flex items-center justify-between">
              <span>Sample price:</span><span className="font-bold">{formatCurrency(1250.5, form.currency)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>With {form.defaultTaxRate}% tax:</span><span className="font-bold">{formatCurrency(1250.5 * (1 + form.defaultTaxRate / 100), form.currency)}</span>
            </div>
          </div>
        </Card>
      )}

      {tab === "theme" && (
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Palette className="h-4 w-4" /> Theme</div>
              <p className="mt-1 text-xs text-slate-400">The professional light theme with navy accents is the signature look of this build.</p>
              <div className="mt-3 flex gap-2">
                <div className="flex-1 rounded-xl border-2 border-navy-600 p-3">
                  <div className="mb-2 flex gap-1"><span className="h-4 w-4 rounded-full bg-navy-950" /><span className="h-4 w-4 rounded-full bg-navy-500" /><span className="h-4 w-4 rounded-full bg-emerald-400" /></div>
                  <Badge tone="green">Active · Light + Navy</Badge>
                </div>
                <div className="flex-1 rounded-xl border border-slate-200 p-3 opacity-50">
                  <div className="mb-2 flex gap-1"><span className="h-4 w-4 rounded-full bg-slate-800" /><span className="h-4 w-4 rounded-full bg-slate-400" /><span className="h-4 w-4 rounded-full bg-sky-400" /></div>
                  <Badge tone="slate">Coming soon</Badge>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><ReceiptText className="h-4 w-4" /> Receipt Options</div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.showLogoOnReceipt} onChange={(e) => setForm({ ...form, showLogoOnReceipt: e.target.checked })} className="h-4 w-4 rounded accent-navy-700" />
                Show pharmacy header on thermal receipts
              </label>
              <div className="mt-3 text-xs text-slate-400">Date & number formatting follows Pakistani conventions (dd-MMM-yyyy, Rs. with thousands separators).</div>
            </div>
          </div>
        </Card>
      )}

      {tab === "data" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><DatabaseZap className="h-4 w-4" /> Local Database</div>
            <p className="mt-1 text-xs text-slate-500">
              Data persists in this browser via IndexedDB. Records: {s.medicines.length} medicines · {s.sales.length} sales · {s.purchases.length} purchases · {s.movements.length} ledger entries.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportBackup}><Download className="h-4 w-4" /> Download Backup (JSON)</Button>
              <label className="inline-flex">
                <input ref={importRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
                <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> Restore Backup</Button>
              </label>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><RefreshCcw className="h-4 w-4" /> Demo Data Tools</div>
            <p className="mt-1 text-xs text-slate-500">Reset restores the original seeded demo dataset. Clear empties the database completely (fresh start).</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}><RefreshCcw className="h-4 w-4" /> Reset Demo Data</Button>
              <Button variant="danger" size="sm" onClick={() => setClearOpen(true)}><Trash2 className="h-4 w-4" /> Clear All Data</Button>
            </div>
            <div className="mt-4">
              <Alert tone="amber" title="Reset replaces everything">Both actions overwrite your current local data. Download a backup first if you want to keep it.</Alert>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} danger title="Reset demo data?"
        message="This replaces all current data with the original seeded demo dataset. Continue?" confirmLabel="Reset Demo"
        onConfirm={() => { store.resetDemoData(); toast.success("Demo data reset", "Fresh sample dataset loaded"); }} />
      <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} danger title="Clear all data?"
        message="This deletes every record and leaves an empty database. Continue?" confirmLabel="Clear Everything"
        onConfirm={() => { store.clearAllData(); toast.success("All data cleared"); }} />
    </div>
  );
}
