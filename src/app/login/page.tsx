"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Cross, ShieldCheck, ArrowRight, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ROLE_META: Record<string, { desc: string; tone: string }> = {
  administrator: { desc: "Full access to every module", tone: "from-violet-500 to-purple-700" },
  pharmacist: { desc: "POS, medicines, reports, returns", tone: "from-emerald-500 to-teal-700" },
  cashier: { desc: "POS, sales, customers", tone: "from-sky-500 to-blue-700" },
  inventory_manager: { desc: "Inventory, purchases, transfers", tone: "from-amber-500 to-orange-700" },
};

export default function LoginPage() {
  const users = useStore((s) => s.users);
  const settings = useStore((s) => s.settings);
  const login = useStore((s) => s.login);
  const currentUser = useStore((s) => s.currentUser);
  const router = useRouter();
  const [selected, setSelected] = useState<string>("admin");
  const [error, setError] = useState("");

  // Already signed in (e.g. session restored from IndexedDB)? Go straight in.
  useEffect(() => {
    if (currentUser) router.replace("/");
  }, [currentUser, router]);

  const user = users.find((u) => u.username === selected);

  function signIn() {
    if (!user) return;
    if (login(user.username)) {
      router.push("/");
    } else {
      setError("This account is inactive.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30">
            <Cross className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">{settings.pharmacyName}</h1>
          <p className="mt-1 text-sm text-white/50">Medical Store Management &amp; Pharmacy POS — Demo Sign-in</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200/90">
            <Info className="h-4 w-4 shrink-0" />
            Demonstration authentication — select a demo account. No password required.
          </div>
          <div className="space-y-2">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => { setSelected(u.username); setError(""); }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                  selected === u.username
                    ? "border-emerald-400/60 bg-emerald-400/10"
                    : "border-white/10 bg-white/[.03] hover:border-white/25"
                )}
              >
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white", ROLE_META[u.role].tone)}>
                  {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{u.name}</div>
                  <div className="truncate text-[11px] text-white/45">{ROLE_META[u.role].desc}</div>
                </div>
                <ShieldCheck className={cn("h-4 w-4", selected === u.username ? "text-emerald-400" : "text-white/20")} />
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
          <button
            onClick={signIn}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow-lg shadow-emerald-500/25 transition-transform active:scale-[.98]"
          >
            Sign in as {user?.role.replace("_", " ")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-6 text-center text-[11px] text-white/35">
          Demo build · Data persists locally in this browser via IndexedDB
        </p>
      </motion.div>
    </div>
  );
}
