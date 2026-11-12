"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ShieldCheck, ShieldOff, UserCog, History, KeyRound, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Button, Input, Select, Badge, Modal, Field, EmptyState, PageHeader, TableWrap, Th, Td, StatCard, ConfirmDialog, Alert, Tabs } from "@/components/ui";
import { toast } from "@/components/toast";
import { formatDateTime, formatDate, cn } from "@/lib/utils";
import { roleLabel } from "@/components/nav";
import type { Role, StaffUser } from "@/lib/types";

const ROLE_TONES: Record<Role, "violet" | "green" | "blue" | "amber"> = {
  administrator: "violet", pharmacist: "green", cashier: "blue", inventory_manager: "amber",
};

export default function StaffPage() {
  const store = useStore();
  const users = useStore((s) => s.users);
  const activity = useStore((s) => s.activityLog);
  const sales = useStore((s) => s.sales);

  const [tab, setTab] = useState("users");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [form, setForm] = useState<{ name: string; username: string; role: Role; phone: string; active: boolean }>({ name: "", username: "", role: "cashier", phone: "", active: true });
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);

  function save() {
    if (!form.name.trim() || !form.username.trim()) { toast.error("Name and username required"); return; }
    if (!editing && users.some((u) => u.username.toLowerCase() === form.username.trim().toLowerCase())) {
      toast.error("Username already exists"); return;
    }
    if (editing) {
      store.updateUser(editing.id, form);
      toast.success("User updated", form.name);
    } else {
      store.addUser(form);
      toast.success("User added", `${form.name} (${roleLabel(form.role)})`);
    }
    setFormOpen(false);
  }

  return (
    <div>
      <PageHeader title="Staff Management" subtitle="Demo role-based access — not production-grade authentication"
        actions={<Button size="sm" onClick={() => { setEditing(null); setForm({ name: "", username: "", role: "cashier", phone: "", active: true }); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add User</Button>} />

      <div className="mb-4">
        <Alert tone="blue" title="Demonstration authentication">
          Accounts are selected without passwords in this demo. Permission-based navigation is enforced in the UI only — integrate a real auth provider (e.g. NextAuth/Clerk) before production use.
        </Alert>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Users" value={String(users.length)} icon={<UserCog className="h-5 w-5" />} tone="navy" />
        <StatCard label="Active" value={String(users.filter((u) => u.active).length)} icon={<ShieldCheck className="h-5 w-5" />} tone="green" />
        <StatCard label="Activity Entries" value={String(activity.length)} icon={<History className="h-5 w-5" />} tone="violet" />
        <StatCard label="Sales by Current User" value={String(sales.filter((s) => s.cashierName === store.currentUser?.name).length)} icon={<KeyRound className="h-5 w-5" />} tone="amber" />
      </div>

      <Tabs active={tab} onChange={setTab} className="mb-4 max-w-md"
        tabs={[{ id: "users", label: "Users", count: users.length }, { id: "activity", label: "Activity Log" }, { id: "permissions", label: "Permissions" }]} />

      {tab === "users" && (
        <Card>
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead><tr><Th>User</Th><Th>Username</Th><Th>Role</Th><Th>Phone</Th><Th className="text-right">Sales Made</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-[11px] font-bold text-navy-700">{u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                        <div>
                          <div className="font-medium text-slate-800">{u.name} {u.id === store.currentUser?.id && <Badge tone="green">You</Badge>}</div>
                          <div className="text-[11px] text-slate-400">since {formatDate(u.createdAt.slice(0, 10))}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="font-mono text-[12px]">{u.username}</Td>
                    <Td><Badge tone={ROLE_TONES[u.role]}>{roleLabel(u.role)}</Badge></Td>
                    <Td>{u.phone}</Td>
                    <Td className="text-right">{sales.filter((s) => s.cashierName === u.name).length}</Td>
                    <Td><Badge tone={u.active ? "green" : "slate"}>{u.active ? "Active" : "Disabled"}</Badge></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(u); setForm({ name: u.name, username: u.username, role: u.role, phone: u.phone, active: u.active }); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title={u.active ? "Disable" : "Enable"} onClick={() => { store.updateUser(u.id, { active: !u.active }); toast.success(u.active ? "User disabled" : "User enabled", u.name); }}>
                          {u.active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="text-rose-500 hover:bg-rose-50" disabled={u.id === store.currentUser?.id} onClick={() => setDeleteTarget(u)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {tab === "activity" && (
        <Card className="p-3">
          <div className="max-h-[560px] space-y-1 overflow-y-auto">
            {activity.slice(0, 100).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold uppercase text-slate-500">{a.userName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                  <div>
                    <div className="text-[13px] font-medium text-slate-700">{a.action.replace("_", " ")}</div>
                    <div className="text-[11px] text-slate-400">{a.detail}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">{formatDateTime(a.date)}</div>
                  <div className="text-[10px] text-slate-400">{a.userName}</div>
                </div>
              </div>
            ))}
            {!activity.length && <EmptyState icon={<History className="h-7 w-7" />} title="No activity yet" />}
          </div>
        </Card>
      )}

      {tab === "permissions" && (
        <Card>
          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead><tr><Th>Module</Th><Th className="text-center">Admin</Th><Th className="text-center">Pharmacist</Th><Th className="text-center">Cashier</Th><Th className="text-center">Inventory</Th></tr></thead>
              <tbody>
                {[
                  ["Dashboard", true, true, true, true],
                  ["POS / Sales", true, true, true, false],
                  ["Medicines & Inventory", true, true, true, true],
                  ["Purchases & Receiving", true, true, false, true],
                  ["Issuance & Transfers", true, false, false, true],
                  ["Expiry Management", true, true, true, true],
                  ["Suppliers", true, true, false, true],
                  ["Customers", true, true, true, false],
                  ["Returns", true, true, false, true],
                  ["Expenses & Finance", true, false, false, false],
                  ["Reports", true, true, false, true],
                  ["Staff Management", true, false, false, false],
                ].map(([module, a, p, c, i]) => (
                  <tr key={module as string}>
                    <Td className="font-medium">{module}</Td>
                    {[a, p, c, i].map((v, j) => (
                      <Td key={j} className="text-center">
                        {v ? <ShieldCheck className="mx-auto h-4 w-4 text-emerald-500" /> : <span className="text-slate-300">—</span>}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <div className="px-4 py-3 text-xs text-slate-400">Navigation items are filtered per role in the sidebar. This is UI-level demo enforcement.</div>
        </Card>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit User" : "Add User"} size="sm"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>}>
        <div className="space-y-3">
          <Field label="Full Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Username" required><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editing} /></Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="administrator">Administrator</option>
              <option value="pharmacist">Pharmacist</option>
              <option value="cashier">Cashier</option>
              <option value="inventory_manager">Inventory Manager</option>
            </Select>
          </Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={form.active ? "active" : "disabled"} onChange={(e) => setForm({ ...form, active: e.target.value === "active" })}>
              <option value="active">Active</option><option value="disabled">Disabled</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete user?"
        message={`Delete ${deleteTarget?.name}? Their past activity entries remain.`} confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) { store.deleteUser(deleteTarget.id); toast.success("User deleted"); } }} />
    </div>
  );
}
