"use client";

import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide icon name resolved in AppShell
  group: "Overview" | "Operations" | "Inventory" | "Trade" | "Finance" | "System";
  roles: Role[] | "all";
  badgeKey?: "lowStock" | "expiring" | "payables";
  /** Optional submenu (dropdown) — shown as an expandable list under this item */
  children?: { href: string; label: string }[];
}

export const REPORT_MENU: { href: string; label: string; group: string }[] = [
  { href: "/reports?type=daily_sales", label: "Daily Sales", group: "Sales" },
  { href: "/reports?type=monthly_sales", label: "Monthly Sales", group: "Sales" },
  { href: "/reports?type=medicine_sales", label: "Medicine-wise Sales", group: "Sales" },
  { href: "/reports?type=category_sales", label: "Category-wise Sales", group: "Sales" },
  { href: "/reports?type=purchases", label: "Purchase Report", group: "Buying" },
  { href: "/reports?type=supplier", label: "Supplier Report", group: "Buying" },
  { href: "/reports?type=inventory_valuation", label: "Inventory Valuation", group: "Inventory" },
  { href: "/reports?type=stock_movement", label: "Stock Movement", group: "Inventory" },
  { href: "/reports?type=expiry", label: "Expiry Report", group: "Inventory" },
  { href: "/reports?type=low_stock", label: "Low Stock Report", group: "Inventory" },
  { href: "/reports?type=pnl", label: "Profit & Loss", group: "Finance" },
  { href: "/reports?type=expenses", label: "Expense Report", group: "Finance" },
  { href: "/reports?type=customer", label: "Customer Report", group: "Finance" },
  { href: "/reports?type=returns", label: "Returns Report", group: "Finance" },
];

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard", group: "Overview", roles: "all" },
  { href: "/pos", label: "POS / New Sale", icon: "ShoppingCart", group: "Operations", roles: "all" },
  { href: "/sales", label: "Sales History", icon: "ReceiptText", group: "Operations", roles: "all" },
  { href: "/sales-returns", label: "Sales Returns", icon: "Undo2", group: "Operations", roles: ["administrator", "pharmacist", "inventory_manager"] },
  { href: "/medicines", label: "Medicines", icon: "Pill", group: "Inventory", roles: "all" },
  { href: "/inventory", label: "Inventory", icon: "Boxes", group: "Inventory", roles: "all" },
  { href: "/reorder", label: "Reorder Advisor", icon: "Lightbulb", group: "Inventory", roles: ["administrator", "inventory_manager", "pharmacist"] },
  { href: "/expiry", label: "Expiry Management", icon: "CalendarClock", group: "Inventory", roles: "all" },
  { href: "/issuance", label: "Stock Issuance", icon: "FileOutput", group: "Inventory", roles: ["administrator", "inventory_manager"] },
  { href: "/transfers", label: "Stock Transfers", icon: "ArrowLeftRight", group: "Inventory", roles: ["administrator", "inventory_manager"] },
  { href: "/purchases", label: "Purchases", icon: "FileSpreadsheet", group: "Trade", roles: ["administrator", "inventory_manager", "pharmacist"] },
  { href: "/receiving", label: "Receiving", icon: "PackageCheck", group: "Trade", roles: ["administrator", "inventory_manager", "pharmacist"] },
  { href: "/purchase-returns", label: "Purchase Returns", icon: "PackageMinus", group: "Trade", roles: ["administrator", "inventory_manager"] },
  { href: "/suppliers", label: "Suppliers", icon: "Truck", group: "Trade", roles: ["administrator", "inventory_manager", "pharmacist"] },
  { href: "/customers", label: "Customers", icon: "Users", group: "Trade", roles: "all" },
  { href: "/expenses", label: "Expenses", icon: "Wallet", group: "Finance", roles: ["administrator"] },
  { href: "/finance", label: "Financial Accounts", icon: "Landmark", group: "Finance", roles: ["administrator"] },
  {
    href: "/reports", label: "Reports Center", icon: "BarChart3", group: "Finance",
    roles: ["administrator", "pharmacist", "inventory_manager"],
    children: REPORT_MENU.map(({ href, label }) => ({ href, label })),
  },
  { href: "/staff", label: "Staff Management", icon: "UserCog", group: "System", roles: ["administrator"] },
  { href: "/settings", label: "Settings", icon: "Settings", group: "System", roles: "all" },
];

export function canAccess(item: NavItem, role?: Role) {
  if (!role) return false;
  return item.roles === "all" || item.roles.includes(role);
}

export function roleLabel(role: Role) {
  const map: Record<Role, string> = {
    administrator: "Administrator",
    pharmacist: "Pharmacist",
    cashier: "Cashier",
    inventory_manager: "Inventory Manager",
  };
  return map[role];
}
