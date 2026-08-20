import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { invalidateAll, useProfile, useProjects, useReceipt, useSignedImage } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORIES,
  PAYMENT_METHODS,
  money,
  num,
  validateReceipt,
  type ExpenseCategory,
  type PaymentMethod,
} from "@/lib/domain";

export const Route = createFileRoute("/receipts/$id")({
  head: () => ({
    meta: [
      { title: "Review receipt — JobLedger" },
      { name: "description", content: "Check the AI-extracted vendor, taxes and totals, then approve the expense." },
      { property: "og:title", content: "Review receipt — JobLedger" },
      { property: "og:description", content: "Approve receipts before they hit your job costs." },
    ],
  }),
  component: ReceiptDetail,
});

function ReceiptDetail() {
  const { id } = useParams({ from: "/receipts/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: receipt, isLoading } = useReceipt(id);
  const { data: projects = [] } = useProjects(user?.id);
  const { data: imageUrl } = useSignedImage(receipt?.image_path);

  const [form, setForm] = useState({
    vendor: "",
    receipt_date: "",
    subtotal: "",
    gst_hst: "",
    other_tax: "",
    total: "",
    receipt_number: "",
    category: "other" as ExpenseCategory,
    payment_method: "none",
    project_id: "none",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const receiptId = receipt?.id;

  useEffect(() => {
    if (!receipt) return;
    setForm({
      vendor: receipt.vendor ?? "",
      receipt_date: receipt.receipt_date ?? "",
      subtotal: receipt.subtotal == null ? "" : String(receipt.subtotal),
      gst_hst: receipt.gst_hst == null ? "" : String(receipt.gst_hst),
      other_tax: receipt.other_tax == null ? "" : String(receipt.other_tax),
      total: String(receipt.total ?? ""),
      receipt_number: receipt.receipt_number ?? "",
      category: receipt.category,
      payment_method: receipt.payment_method ?? "none",
      project_id: receipt.project_id ?? "none",
      notes: receipt.notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptId]);

  const warnings = validateReceipt(
    {
      subtotal: num(form.subtotal),
      gst_hst: num(form.gst_hst),
      other_tax: num(form.other_tax),
      total: num(form.total),
      receipt_date: form.receipt_date || null,
      vendor: form.vendor || null,
      project_id: form.project_id === "none" ? null : form.project_id,
    },
    profile?.mode === "job" ? "job" : "expense",
  );

  async function save(approve: boolean) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("receipts")
        .update({
          vendor: form.vendor || null,
          receipt_date: form.receipt_date || null,
          subtotal: form.subtotal === "" ? null : num(form.subtotal),
          gst_hst: form.gst_hst === "" ? null : num(form.gst_hst),
          other_tax: form.other_tax === "" ? null : num(form.other_tax),
          total: num(form.total),
          receipt_number: form.receipt_number || null,
          category: form.category,
          payment_method: form.payment_method === "none" ? null : (form.payment_method as PaymentMethod),
          project_id: form.project_id === "none" ? null : form.project_id,
          notes: form.notes || null,
          warnings,
          review_status: approve ? "approved" : "needs_review",
        })
        .eq("id", id);
      if (error) throw error;
      invalidateAll(qc);
      toast.success(approve ? "Receipt approved." : "Changes saved.");
      if (approve) navigate({ to: "/receipts" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this receipt.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("receipts").delete().eq("id", id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidateAll(qc);
    navigate({ to: "/receipts" });
  }

  if (isLoading) {
    return (
      <AppShell title="Receipt">
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (!receipt) {
    return (
      <AppShell title="Receipt">
        <p className="py-10 text-center text-sm text-muted-foreground">This receipt no longer exists.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Review receipt" subtitle={money(num(form.total), receipt.currency)}>
      <div className="space-y-4">
        {imageUrl ? (
          <div className="panel overflow-hidden">
            <img src={imageUrl} alt="Receipt" className="max-h-80 w-full bg-muted object-contain" />
          </div>
        ) : null}

        {warnings.length ? (
          <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-accent">
              <AlertTriangle className="size-4" /> Needs a look
            </p>
            <ul className="mt-1 list-disc pl-6 text-xs text-muted-foreground">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="panel space-y-4 p-4">
          <Row label="Vendor">
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </Row>
          <Row label="Date">
            <Input
              type="date"
              value={form.receipt_date}
              onChange={(e) => setForm({ ...form, receipt_date: e.target.value })}
            />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Subtotal">
              <Input inputMode="decimal" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
            </Row>
            <Row label="GST/HST">
              <Input inputMode="decimal" value={form.gst_hst} onChange={(e) => setForm({ ...form, gst_hst: e.target.value })} />
            </Row>
            <Row label="Other tax">
              <Input inputMode="decimal" value={form.other_tax} onChange={(e) => setForm({ ...form, other_tax: e.target.value })} />
            </Row>
            <Row label="Total">
              <Input inputMode="decimal" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
            </Row>
          </div>
          <Row label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ExpenseCategory })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Payment method">
            <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {PAYMENT_METHODS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          {profile?.mode === "job" ? (
            <Row label="Project">
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          ) : null}
          <Row label="Receipt #">
            <Input value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} />
          </Row>
          <Row label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Row>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => save(true)}>
            Approve
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete receipt" disabled={busy} onClick={remove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
