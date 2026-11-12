# MediCore Pharmacy Pro — Medical Store Management & POS

A complete, professional **Medical Store Management & Pharmacy POS demo** built with Next.js (App Router), TypeScript, Tailwind CSS, Recharts, and Framer Motion. All data is stored locally in your browser (IndexedDB) — no backend, no paid services, fully Vercel-deployable.

> **DEMO** — Seeded with a realistic Pakistani pharmacy dataset (50 medicines, multi-batch stock with expiry, 10 suppliers, 20 customers, sales, purchases, expenses, and 4 staff accounts).

---

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

To run on a different port:

```bash
npm run dev -- -p 3001
```

### Production build

```bash
npm run build
npm start
```

---

## 🔑 Demo Login

The app opens with a login screen. Pick any demo account (no password required):

| User | Role | Access |
|---|---|---|
| **Admin** | Administrator | Full access to all modules |
| **Pharmacist** | Pharmacist | POS, sales, medicines, purchasing, reports |
| **Cashier** | Cashier | **POS & sales only** — no dashboard, reports or inventory |
| **Stock Manager** | Inventory Manager | **Inventory management only** — no POS, dashboard or reports |

Access is enforced at page level: blocked modules show an "Access restricted" screen even when opened by direct URL.

---

## 📦 Modules (20 + Login + Settings)

| Module | What it does |
|---|---|
| **Dashboard** | KPIs (stock value, today's sales, receivables), sales & category charts, low-stock/expiry alerts |
| **POS** | Fast billing, batch selection with **FEFO** (first-expiry-first-out) deduction, Rx warnings, credit sales, thermal receipt print |
| **Sales** | Sale history, invoices (A4 print), payment status, customer credit tracking |
| **Medicines** | Master list — generics, manufacturers, categories, reorder levels, rack locations |
| **Inventory** | Batch-level view — per-batch cost, expiry, quantity, and valuation |
| **Reorder Advisor** | Smart purchase suggestions from sales velocity + lead time; one-click draft POs, CSV & print |
| **Purchases** | Purchase orders to suppliers with order → receive workflow |
| **Receiving** | GRN (Goods Received Notes) — receive POs into stock with batch/expiry entry, print GRN |
| **Issuance** | Issue stock internally (wards/departments) with movement logging |
| **Transfers** | Stock transfers between locations with full audit trail |
| **Expiry** | Expired & near-expiry batch report with write-off actions |
| **Suppliers** | Supplier directory with balances and purchase history |
| **Customers** | Customer directory with credit limits, balances, and walk-in support |
| **Sales Returns** | Return items back into stock (batch-aware), refunds or credit notes |
| **Purchase Returns** | Return damaged/expired stock to suppliers |
| **Expenses** | Expense categories & recording (rent, salaries, utilities…) |
| **Finance** | Cash ledger, receivables/payables, payments to suppliers & from customers |
- **Reports** | Reports Center — 14 report types (sales, purchases, stock, expiry, profit…) with **CSV export** and print; every report is also reachable from the sidebar **Reports dropdown** |
| **Staff** | User accounts & role management |
| **Settings** | Store profile, tax rate, currency, **backup/restore (JSON)**, reset demo data, clear all data |

---

## 🧪 Testing Guide (suggested flow)

1. **Login** as Admin → verify the dashboard loads with stats and charts.
2. **POS** → add items to cart, pick a batch (earliest expiry first), complete a sale → print the thermal receipt.
3. **Sales** → find the new sale, open the A4 invoice, note the reduced stock.
4. **Inventory** → confirm the batch quantity was deducted FEFO-style (earliest-expiry batch reduced first).
5. **Purchases** → create a PO → go to **Receiving** → receive it with batch/expiry details → stock increases.
6. **Sales Returns** → return an item from the sale → stock returns to the batch.
7. **Finance** → record a customer payment / supplier payment → check the cash ledger.
8. **Reports** → run the Sales report → export CSV or print.
9. **Settings** → try **Backup** (downloads JSON) and **Reset Demo Data** to restore the seed.

Data persists across refreshes (IndexedDB). Use *Settings → Reset Demo Data* any time to start fresh.

---

## ☁️ Deploy to Vercel

1. Push this project to a GitHub/GitLab/Bitbucket repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Vercel auto-detects Next.js — no environment variables needed.
4. Click **Deploy**. Done — the app runs entirely client-side.

Or via CLI:

```bash
npm i -g vercel
vercel
```

---

## 🏗️ Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — premium white/light theme with dark navy accents
- **Recharts** — dashboard & report charts
- **Framer Motion** — smooth transitions & animations
- **Zustand + idb-keyval** — state management with IndexedDB persistence
- **lucide-react** — icons

## 📐 Business Logic Highlights

- **Batch-aware stock**: the same medicine can have multiple batches, each with its own expiry and cost.
- **FEFO deduction**: sales always consume the earliest-expiring sellable batch first.
- **Expired batches are never sellable** — shown in the Expiry module for write-off.
- **Credit control**: credit sales are blocked beyond a customer's credit limit.
- **Full audit trail**: every stock and financial action writes stock movements and cash ledger entries.
- **Collapsible sidebar groups**: sections expand/collapse (state is remembered), with a Reports dropdown listing every report.
- **User menu (top-right avatar)**: Settings, Switch User and Sign Out.
- **Flexible discounts**: invoice discount in **Rs. or %** (plus per-line Rs. discounts).
- **Customer & supplier statements**: printable statements with running balances.
- **Login is enforced**: any page redirects to sign-in when no user is logged in.

## ⚠️ Demo Limitations

- Authentication is demo-only (no passwords, no server-side sessions).
- "PDF download" uses the browser's print dialog (Save as PDF) rather than embedded PDF generation.
- Data lives only in the current browser's IndexedDB — use Settings → Backup/Restore to move data between devices.
- No real payment gateway or tax-filing engine; tax is a simple configurable percentage.
- Barcode scanning is simulated via search; no hardware integration.
