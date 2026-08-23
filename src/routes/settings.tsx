import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmailForwarding } from "@/components/EmailForwarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/lib/queries";
import type { AppMode } from "@/lib/domain";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — JobLedger" },
      { name: "description", content: "Switch between job costing and expense mode, and tune your budget alerts." },
      { property: "og:title", content: "Settings — JobLedger" },
      { property: "og:description", content: "Business profile, mode and budget alert thresholds." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const update = useUpdateProfile(user?.id);
  const [form, setForm] = useState({
    business_name: "",
    mode: "job" as AppMode,
    accounting_software: "none",
    budget_warn_pct: "80",
    budget_critical_pct: "100",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      business_name: profile.business_name,
      mode: profile.mode,
      accounting_software: profile.accounting_software,
      budget_warn_pct: String(profile.budget_warn_pct),
      budget_critical_pct: String(profile.budget_critical_pct),
    });
  }, [profile?.id]);

  async function save() {
    setBusy(true);
    try {
      await update.mutateAsync({
        business_name: form.business_name.trim(),
        mode: form.mode,
        accounting_software: form.accounting_software,
        budget_warn_pct: Number(form.budget_warn_pct) || 80,
        budget_critical_pct: Number(form.budget_critical_pct) || 100,
      });
      toast.success("Settings saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Settings" subtitle={user?.email ?? "Your account"}>
      <div className="panel space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="bn">Business name</Label>
          <Input id="bn" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as AppMode })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="job">Job mode — projects & profitability</SelectItem>
              <SelectItem value="expense">Expense mode — receipts only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Accounting software</Label>
          <Select value={form.accounting_software} onValueChange={(v) => setForm({ ...form, accounting_software: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="quickbooks">QuickBooks Online</SelectItem>
              <SelectItem value="xero">Xero</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="warn">Budget warning %</Label>
            <Input
              id="warn"
              inputMode="numeric"
              value={form.budget_warn_pct}
              onChange={(e) => setForm({ ...form, budget_warn_pct: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="crit">Budget critical %</Label>
            <Input
              id="crit"
              inputMode="numeric"
              value={form.budget_critical_pct}
              onChange={(e) => setForm({ ...form, budget_critical_pct: e.target.value })}
            />
          </div>
        </div>

        <Button className="w-full" disabled={busy} onClick={save}>
          Save settings
        </Button>
      </div>

      <EmailForwarding userId={user?.id} />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Receipt images stay private to your account. JobLedger is not tax or accounting advice.
      </p>
    </AppShell>
  );
}
