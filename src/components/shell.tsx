"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, ShoppingCart, ReceiptText, Pill, Boxes, FileSpreadsheet, PackageCheck,
  FileOutput, ArrowLeftRight, CalendarClock, Truck, Users, Undo2, PackageMinus, Wallet,
  Landmark, BarChart3, UserCog, Settings, Cross, LogOut, Menu, Bell, Search, ChevronRight,
  ChevronDown, Store, AlertTriangle, Hourglass, Banknote, RefreshCw, Lightbulb,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { NAV, canAccess, roleLabel, type NavItem } from "./nav";
import { cn, formatDate, daysUntil } from "@/lib/utils";
import { sellableStock } from "@/lib/stock";
import { Badge } from "./ui";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, ShoppingCart, ReceiptText, Pill, Boxes, FileSpreadsheet, PackageCheck,
  FileOutput, ArrowLeftRight, CalendarClock, Truck, Users, Undo2, PackageMinus, Wallet,
  Landmark, BarChart3, UserCog, Settings, Lightbulb,
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function useAlerts() {
  const medicines = useStore((s) => s.medicines);
  const settings = useStore((s) => s.settings);
  return useMemo(() => {
    let lowStock = 0, expiring = 0;
    for (const m of medicines) {
      if (sellableStock(m) <= Math.max(m.minStockLevel, settings.lowStockThreshold)) lowStock++;
      for (const b of m.batches) {
        const d = daysUntil(b.expiryDate);
        if (b.quantity > 0 && d >= 0 && d <= settings.expiryWarnDays) { expiring++; break; }
      }
    }
    return { lowStock, expiring };
  }, [medicines, settings.lowStockThreshold, settings.expiryWarnDays]);
}

const NAV_OPEN_KEY = "medicore-nav-open-groups";

function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = useStore((s) => s.currentUser);
  const settings = useStore((s) => s.settings);
  const medicines = useStore((s) => s.medicines);

  const badges = useMemo(() => {
    let lowStock = 0, expiring = 0;
    for (const m of medicines) {
      if (sellableStock(m) <= Math.max(m.minStockLevel, settings.lowStockThreshold)) lowStock++;
      for (const b of m.batches) {
        const d = daysUntil(b.expiryDate);
        if (b.quantity > 0 && d >= 0 && d <= settings.expiryWarnDays) { expiring++; break; }
      }
    }
    return { lowStock, expiring };
  }, [medicines, settings.lowStockThreshold, settings.expiryWarnDays]);

  const groups: NavItem["group"][] = ["Overview", "Operations", "Inventory", "Trade", "Finance", "System"];
  const accessible = NAV.filter((n) => canAccess(n, user?.role));

  // Collapsible groups — open state persists in localStorage; the group holding
  // the active page is always expanded so the user never loses their place.
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    if (typeof window === "undefined") return groups;
    try {
      const saved = JSON.parse(localStorage.getItem(NAV_OPEN_KEY) ?? "null");
      if (Array.isArray(saved)) return saved;
    } catch { /* ignore */ }
    return groups;
  });
  useEffect(() => {
    try { localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(openGroups)); } catch { /* ignore */ }
  }, [openGroups]);
  useEffect(() => {
    const holder = accessible.find((n) =>
      n.href === pathname || n.children?.some((c) => c.href.split("?")[0] === pathname));
    if (holder && !openGroups.includes(holder.group)) {
      setOpenGroups((g) => [...g, holder.group]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (g: string) =>
    setOpenGroups((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const reportsType = searchParams.get("type");

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {groups.map((g) => {
        const items = accessible.filter((n) => n.group === g);
        if (!items.length) return null;
        const isOpen = openGroups.includes(g);
        const groupActive = items.some((n) =>
          n.href === pathname || n.children?.some((c) => c.href.split("?")[0] === pathname));
        return (
          <div key={g} className={cn("rounded-xl transition-colors", isOpen && "bg-white/[.04]")}>
            <button
              onClick={() => toggleGroup(g)}
              className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/40 transition-colors hover:text-white/70"
            >
              <span className="flex items-center gap-1.5">
                {groupActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                {g}
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen ? "rotate-180" : "")} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-0.5 px-1 pb-1.5">
                    {items.map((item) => (
                      <NavItemRow
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        reportsType={reportsType}
                        badges={badges}
                        router={router}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}

function NavItemRow({ item, pathname, reportsType, badges, router, onNavigate }: {
  item: NavItem;
  pathname: string;
  reportsType: string | null;
  badges: { lowStock: number; expiring: number };
  router: ReturnType<typeof useRouter>;
  onNavigate?: () => void;
}) {
  const [subOpen, setSubOpen] = useState(false);
  const Icon = ICONS[item.icon] ?? Pill;
  const active = pathname === item.href;
  const childActive = item.children?.some((c) => c.href === `${pathname}?type=${reportsType}`);
  const count =
    item.href === "/inventory" ? badges.lowStock :
    item.href === "/expiry" ? badges.expiring : undefined;

  const go = (href: string) => {
    router.push(href);
    onNavigate?.();
  };

  if (item.children?.length) {
    return (
      <div>
        <button
          onClick={() => { setSubOpen(!subOpen); if (!active) go(item.href); }}
          className={cn(
            "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
            active || childActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[.06] hover:text-white"
          )}
        >
          {active && <motion.div layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-emerald-400" />}
          <Icon className={cn("h-4 w-4 shrink-0", active ? "text-emerald-400" : "text-white/45 group-hover:text-white/80")} />
          <span className="flex-1 truncate text-left">{item.label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-white/35 transition-transform", subOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {subOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="ml-6 mt-0.5 space-y-px border-l border-white/10 pl-2">
                {item.children.map((c) => {
                  const cActive = `${pathname}?type=${reportsType}` === c.href || (pathname === item.href && reportsType === null && c === item.children![0]);
                  return (
                    <a
                      key={c.href}
                      href={c.href}
                      onClick={(e) => { e.preventDefault(); go(c.href); }}
                      className={cn(
                        "block truncate rounded-lg px-2.5 py-1.5 text-[12px] transition-colors",
                        cActive ? "bg-emerald-400/15 font-semibold text-emerald-300" : "text-white/50 hover:bg-white/[.06] hover:text-white"
                      )}
                    >
                      {c.label}
                    </a>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <a
      href={item.href}
      onClick={(e) => { e.preventDefault(); go(item.href); }}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
        active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[.06] hover:text-white"
      )}
    >
      {active && <motion.div layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-emerald-400" />}
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-emerald-400" : "text-white/45 group-hover:text-white/80")} />
      <span className="flex-1 truncate">{item.label}</span>
      {!!count && count > 0 && (
        <span className="rounded-full bg-amber-400/90 px-1.5 py-px text-[10px] font-bold text-navy-950">{count}</span>
      )}
    </a>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useStore((s) => s.currentUser);
  const settings = useStore((s) => s.settings);
  const router = useRouter();

  return (
    <div className="flex h-full flex-col bg-navy-950 text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/20">
          <Cross className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold tracking-tight">{settings.pharmacyName}</div>
          <div className="truncate text-[11px] text-white/45">{settings.branchName}</div>
        </div>
      </div>
      <div className="mx-4 mb-1 rounded-xl bg-white/[.06] px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-white/50">
          <Store className="h-3.5 w-3.5 text-emerald-400" /> Demo environment
        </div>
        <div className="mt-0.5 text-[11px] text-white/35">Local IndexedDB · {formatDate(todayISO())}</div>
      </div>
      <NavGroups onNavigate={onNavigate} />
      {user && (
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-700 text-xs font-bold uppercase text-emerald-400">
              {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{user.name}</div>
              <div className="text-[11px] text-white/45">{roleLabel(user.role)}</div>
            </div>
            <button
              onClick={() => { useStore.getState().logout(); router.push("/login"); }}
              className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-rose-300"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TopSearch() {
  const [q, setQ] = useState("");
  const medicines = useStore((s) => s.medicines);
  const router = useRouter();
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const s = q.toLowerCase();
    return medicines
      .filter((m) => m.name.toLowerCase().includes(s) || m.genericName.toLowerCase().includes(s) || m.sku.toLowerCase().includes(s) || m.barcode.includes(s))
      .slice(0, 7);
  }, [q, medicines]);

  return (
    <div className="relative hidden max-w-md flex-1 sm:block">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Global search — medicines, SKU, barcode…"
        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-navy-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/15"
      />
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop"
          >
            {results.map((m) => (
              <button
                key={m.id}
                onClick={() => { router.push(`/medicines?focus=${m.id}`); setQ(""); }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-slate-700">{m.name}</div>
                  <div className="text-[11px] text-slate-400">{m.genericName} · {m.sku}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true }));
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">· {now}</span>;
}

function UserMenu() {
  const user = useStore((s) => s.currentUser);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (!user) return null;

  const signOut = () => {
    useStore.getState().logout();
    router.push("/login");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-xl p-1 pr-2 transition-colors hover:bg-slate-100"
        title="Account menu"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-xs font-bold uppercase text-white">
          {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </div>
        <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }}
              className="absolute right-0 top-12 z-20 w-60 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop"
            >
              <div className="px-3 py-2.5">
                <div className="truncate text-[13px] font-semibold text-slate-800">{user.name}</div>
                <div className="text-[11px] text-slate-400">{roleLabel(user.role)} · {user.username}</div>
              </div>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { setOpen(false); router.push("/settings"); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50"
              >
                <Settings className="h-4 w-4 text-slate-400" /> Settings
              </button>
              <button
                onClick={() => { setOpen(false); signOut(); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4 text-slate-400" /> Switch User
              </button>
              <button
                onClick={() => { setOpen(false); signOut(); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useStore((s) => s.currentUser);
  const hydrated = useStore((s) => s._hydrated);
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { lowStock, expiring } = useAlerts();
  const warnDays = useStore((s) => s.settings.expiryWarnDays);

  useEffect(() => {
    if (hydrated && !user && pathname !== "/login") router.replace("/login");
  }, [hydrated, user, pathname, router]);

  // The sign-in page renders standalone, without the app chrome.
  if (pathname === "/login") return <>{children}</>;

  if (!hydrated) return null;
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <div className="animate-pulse text-sm text-white/50">Redirecting to sign-in…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-navy-950/60 lg:hidden" onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: -290 }} animate={{ x: 0 }} exit={{ x: -290 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-[270px] lg:hidden"
            >
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
            <button onClick={() => setOpen(true)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <TopSearch />
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <div className="hidden items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-xs text-slate-500 md:flex">
                <span className="font-medium text-slate-700">{formatDate(todayISO())}</span>
                <LiveClock />
              </div>
              <div className="relative">
                <button onClick={() => setNotifOpen(!notifOpen)} className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100">
                  <Bell className="h-5 w-5" />
                  {lowStock + expiring > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold text-white">
                      {Math.min(lowStock + expiring, 9)}{lowStock + expiring > 9 ? "+" : ""}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }}
                        className="absolute right-0 top-12 z-20 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-pop"
                      >
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Alerts</div>
                        {lowStock === 0 && expiring === 0 && (
                          <div className="px-3 py-4 text-center text-xs text-slate-400">No alerts — all clear</div>
                        )}
                        {lowStock > 0 && (
                          <button onClick={() => { setNotifOpen(false); router.push("/inventory"); }} className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                            <div>
                              <div className="text-[13px] font-medium text-slate-700">{lowStock} medicines low on stock</div>
                              <div className="text-[11px] text-slate-400">Reorder soon to avoid stockouts</div>
                            </div>
                          </button>
                        )}
                        {expiring > 0 && (
                          <button onClick={() => { setNotifOpen(false); router.push("/expiry"); }} className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50">
                            <Hourglass className="mt-0.5 h-4 w-4 text-rose-500" />
                            <div>
                              <div className="text-[13px] font-medium text-slate-700">{expiring} batches expiring soon</div>
                              <div className="text-[11px] text-slate-400">Within {warnDays} days — review expiry management</div>
                            </div>
                          </button>
                        )}
                        <div className="mt-1 flex items-center gap-2 border-t border-slate-100 px-3 pt-2 text-[11px] text-slate-400">
                          <Banknote className="h-3.5 w-3.5" /> Demo data stored in this browser
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <Badge tone="green" className="hidden sm:inline-flex">DEMO</Badge>
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-slate-200/70 px-5 py-3 text-center text-[11px] text-slate-400">
          MediCore Pharmacy ERP · Demonstration build · Data stored locally in this browser · Not for production dispensing use
        </footer>
      </div>
    </div>
  );
}
