import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmailForwarding } from "@/components/EmailForwarding";
import { LogoUploader } from "@/components/LogoUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useBusiness } from "@/lib/business";
import { useUpdateBusiness } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { canManageBusiness, ROLE_LABELS, type AppMode, type MembershipRole } from "@/lib/domain";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — JobLedger" },
      {
        name: "description",
        content: "Switch between job costing and expense mode, and tune your budget alerts.",
      },
      { property: "og:title", content: "Settings — JobLedger" },
      {
        property: "og:description",
        content: "Business profile, mode, team and budget alert thresholds.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { business, businessId, role } = useBusiness();
  const update = useUpdateBusiness(businessId);
  const canManage = canManageBusiness(role);
  const [form, setForm] = useState({
    name: "",
    mode: "job" as AppMode,
    accounting_software: "none",
    budget_warn_pct: "80",
    budget_critical_pct: "100",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!business) return;
    setForm({
      name: business.name,
      mode: business.mode,
      accounting_software: business.accounting_software,
      budget_warn_pct: String(business.budget_warn_pct),
      budget_critical_pct: String(business.budget_critical_pct),
    });
  }, [business?.id]);

  async function save() {
    setBusy(true);
    try {
      await update.mutateAsync({
        name: form.name.trim(),
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
        <LogoUploader
          businessId={businessId}
          logoPath={business?.logo_path}
          name={business?.name}
        />

        <div className="space-y-1.5">
          <Label htmlFor="bn">Business name</Label>
          <Input
            id="bn"
            disabled={!canManage}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select
            disabled={!canManage}
            value={form.mode}
            onValueChange={(v) => setForm({ ...form, mode: v as AppMode })}
          >
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
          <div className="flex items-center gap-2">
            <Label>Accounting software</Label>
            <Badge variant="secondary" className="text-[10px]">
              Coming soon
            </Badge>
          </div>
          <Select
            disabled={!canManage}
            value={form.accounting_software}
            onValueChange={(v) => setForm({ ...form, accounting_software: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="quickbooks">QuickBooks Online</SelectItem>
              <SelectItem value="xero">Xero</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Automatic sync isn't built yet — this just records your preference for when it is. Use
            the exports on the Reports page for now.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="warn">Budget warning %</Label>
            <Input
              id="warn"
              inputMode="numeric"
              disabled={!canManage}
              value={form.budget_warn_pct}
              onChange={(e) => setForm({ ...form, budget_warn_pct: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="crit">Budget critical %</Label>
            <Input
              id="crit"
              inputMode="numeric"
              disabled={!canManage}
              value={form.budget_critical_pct}
              onChange={(e) => setForm({ ...form, budget_critical_pct: e.target.value })}
            />
          </div>
        </div>

        {canManage ? (
          <Button className="w-full" disabled={busy} onClick={save}>
            Save settings
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Only the business owner can change these settings.
          </p>
        )}
      </div>

      {canManage ? <TeamSection businessId={businessId} /> : null}

      {canManage ? <EmailForwarding businessId={businessId} /> : null}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Receipt images stay private to your business. JobLedger is not tax or accounting advice.
      </p>
    </AppShell>
  );
}

const INVITABLE_ROLES: { value: MembershipRole; label: string; hint: string }[] = [
  {
    value: "accountant",
    label: "Accountant",
    hint: "Views everything, corrects categories & tax codes",
  },
  { value: "member", label: "Team member", hint: "Same access as you, minus billing" },
];

function TeamSection({ businessId }: { businessId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("accountant");
  const [busy, setBusy] = useState(false);

  const members = useQuery({
    queryKey: ["members", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, role, status, invited_email, user_id")
        .eq("business_id", businessId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memberships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function invite() {
    if (!businessId || !email.trim()) {
      toast.error("Enter an email address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("invite_member", {
      p_business_id: businessId,
      p_email: email.trim(),
      p_role: inviteRole,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Invited ${email.trim()}. They'll get access the moment they sign in with that email.`,
    );
    setEmail("");
    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["members"] });
  }

  return (
    <div className="panel mt-4 space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="font-medium">Team & accountant access</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <UserPlus className="size-4" /> Invite
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite someone to this business</DialogTitle>
              <DialogDescription>
                They'll need their own JobLedger account with this email — signing in (or signing
                up) with it grants access instantly, no separate accept step.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-email">Email address</Label>
                <Input
                  id="inv-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as MembershipRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITABLE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {INVITABLE_ROLES.find((r) => r.value === inviteRole)?.hint}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button disabled={busy} onClick={invite}>
                Send invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {members.data && members.data.length > 0 ? (
        <ul className="space-y-2">
          {members.data.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                {m.status === "invited" ? (
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate">{m.invited_email ?? "Member"}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[m.role]} ·{" "}
                    {m.status === "invited" ? "Invited — awaiting sign-in" : "Active"}
                  </p>
                </div>
              </div>
              {m.role !== "owner" ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove"
                  onClick={() => remove.mutate(m.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Just you so far.</p>
      )}
    </div>
  );
}
