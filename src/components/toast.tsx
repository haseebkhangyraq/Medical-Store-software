"use client";

import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; title: string; message?: string }

interface ToastState {
  toasts: Toast[];
  push(kind: ToastKind, title: string, message?: string): void;
  dismiss(id: number): void;
}

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push(kind, title, message) {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, kind, title, message }].slice(-4) }));
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (title: string, message?: string) => useToast.getState().push("success", title, message),
  error: (title: string, message?: string) => useToast.getState().push("error", title, message),
  info: (title: string, message?: string) => useToast.getState().push("info", title, message),
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastKind, string> = {
  success: "border-emerald-200 bg-white text-slate-800",
  error: "border-rose-200 bg-white text-slate-800",
  info: "border-sky-200 bg-white text-slate-800",
};

const DOT: Record<ToastKind, string> = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  info: "bg-sky-500",
};

const ICONC: Record<ToastKind, string> = {
  success: "text-emerald-600",
  error: "text-rose-600",
  info: "text-sky-600",
};

export function ToastHost() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className={cn("pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-pop", STYLES[t.kind])}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ICONC[t.kind])} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.message && <div className="mt-0.5 text-xs text-slate-500 break-words">{t.message}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
