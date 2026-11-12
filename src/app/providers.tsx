"use client";

import { useEffect, useState } from "react";
import { useStore, ensureSeeded } from "@/lib/store";
import { ToastHost } from "@/components/toast";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, DatabaseZap } from "lucide-react";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrated = useStore((s) => s._hydrated);
  const [minWait, setMinWait] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMinWait(false), 400);
    // Safety net: if IndexedDB rehydration never completes, force-ready after a moment.
    // NOTE: we only flip the flag here — we never overwrite data, because a slow
    // IndexedDB open could still be in-flight and replacing state now would lose it.
    const fallback = setTimeout(() => {
      useStore.setState({ _hydrated: true });
    }, 2500);
    const unsub = useStore.persist.onFinishHydration(() => ensureSeeded());
    if (useStore.persist.hasHydrated()) ensureSeeded();

    // Self-heal: if this tab is running stale code (dev server restarted / new
    // deploy), client-side navigation fails with a ChunkLoadError and pages
    // render blank. Reload once to pick up the fresh bundle.
    const CHUNK_KEY = "medicore-chunk-reload-at";
    const maybeReload = () => {
      try {
        const last = Number(sessionStorage.getItem(CHUNK_KEY) ?? 0);
        if (Date.now() - last > 10000) {
          sessionStorage.setItem(CHUNK_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch { /* storage unavailable — ignore */ }
    };
    const chunkErr = (msg: string) =>
      msg.includes("ChunkLoadError") || msg.includes("Loading chunk") ||
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("error loading chunk");
    const onErr = (e: ErrorEvent) => { if (chunkErr(e.message ?? "")) maybeReload(); };
    const onRej = (e: PromiseRejectionEvent) => {
      const m = String((e.reason as Error)?.message ?? e.reason ?? "");
      if (chunkErr(m)) maybeReload();
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      clearTimeout(t); clearTimeout(fallback); unsub();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  if (!hydrated || minWait) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-navy-950 text-white">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur"
        >
          <DatabaseZap className="h-8 w-8 text-emerald-400" />
        </motion.div>
        <div>
          <div className="text-lg font-bold tracking-wide">MediCore Pharmacy</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading demo database…
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <ToastHost />
    </>
  );
}

export { AnimatePresence };
