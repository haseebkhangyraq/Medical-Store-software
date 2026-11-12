"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { X, ChevronDown, Search, AlertCircle, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ className, children, hover }: { className?: string; children: ReactNode; hover?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-card", hover && "transition-shadow hover:shadow-pop", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }: { title: string; subtitle?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4", className)}>
      <div>
        <h3 className="text-[15px] font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "success" | "dark";
export function Button({ variant = "primary", size = "md", className, children, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg" | "icon" }) {
  const variants: Record<BtnVariant, string> = {
    primary: "bg-navy-800 text-white hover:bg-navy-700 shadow-sm active:scale-[.98]",
    dark: "bg-navy-950 text-white hover:bg-navy-900 active:scale-[.98]",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[.98]",
    outline: "border border-slate-300 bg-white text-slate-700 hover:border-navy-400 hover:text-navy-700 active:scale-[.98]",
    danger: "bg-rose-600 text-white hover:bg-rose-700 active:scale-[.98]",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[.98]",
    ghost: "text-slate-600 hover:bg-slate-100 active:scale-[.98]",
  };
  const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-9.5 px-4 text-sm gap-2", lg: "h-11 px-5 text-sm gap-2", icon: "h-9 w-9" };
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50",
        variants[variant], sizes[size], className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── Inputs ──────────────────────────────────────────────────────────────────
const inputBase = "w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20 disabled:bg-slate-100";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, "h-10", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(inputBase, "h-10 appearance-none pr-9", className)} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-[80px] py-2", className)} {...props} />;
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className={cn(inputBase, "h-10 pl-9")} {...props} />
    </div>
  );
}

export function Field({ label, children, required, hint, className }: { label: string; children: ReactNode; required?: boolean; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────
type BadgeTone = "slate" | "green" | "red" | "amber" | "blue" | "violet" | "navy";
export function Badge({ tone = "slate", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  const tones: Record<BadgeTone, string> = {
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    navy: "bg-navy-50 text-navy-700 ring-navy-200",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, subtitle, children, size = "md", footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full"; footer?: ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const sizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl", full: "max-w-[95vw]" };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={cn(
              "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl",
              sizes[size]
            )}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-800">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon, tone = "navy", onClick }: {
  label: string; value: string; sub?: string; icon: ReactNode; tone?: BadgeTone; onClick?: () => void;
}) {
  const tones: Record<BadgeTone, string> = {
    navy: "bg-navy-50 text-navy-700",
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <Card hover className={cn("p-4", onClick && "cursor-pointer")} >
      <div onClick={onClick} className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 sm:text-[22px]">{value}</p>
          {sub && <p className="mt-1 truncate text-[11px] text-slate-400">{sub}</p>}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Animated counter number ─────────────────────────────────────────────────
export function Counter({ value, format }: { value: number; format?: (n: number) => string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {format ? format(value) : value.toLocaleString()}
    </motion.span>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon ?? <PackageOpen className="h-7 w-7" />}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-700">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "amber", title, children }: { tone?: "amber" | "red" | "blue"; title: string; children?: ReactNode }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
  };
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs", tones[tone])}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <span className="font-semibold">{title}</span>
        {children && <div className="mt-0.5 opacity-90">{children}</div>}
      </div>
    </div>
  );
}

// ─── Page header ─────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Responsive table helpers ────────────────────────────────────────────────
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full overflow-x-auto", className)}>{children}</div>;
}

export function Th({ className, children }: { className?: string; children?: ReactNode }) {
  return <th className={cn("whitespace-nowrap border-b border-slate-200 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500", className)}>{children}</th>;
}

export function Td({ className, children, colSpan }: { className?: string; children?: ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("border-b border-slate-100 px-4 py-2.5 text-[13px] text-slate-700", className)}>{children}</td>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange, className }: {
  tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void; className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-[13px]",
            active === t.id ? "text-navy-800" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {active === t.id && (
            <motion.div layoutId={`tab-${tabs.map((x) => x.id).join()}`} className="absolute inset-0 rounded-lg bg-white shadow-sm" />
          )}
          <span className="relative flex items-center gap-1.5">
            {t.label}
            {t.count != null && (
              <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", active === t.id ? "bg-navy-100 text-navy-700" : "bg-slate-200 text-slate-500")}>
                {t.count}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
