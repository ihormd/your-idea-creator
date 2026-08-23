import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ImageUp, Layers, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useProfile, useProjects } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, validateReceipt, type ExpenseCategory, type PaymentMethod } from "@/lib/domain";
import { extractReceipt } from "@/lib/receipt-ai.functions";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan a receipt — JobLedger" },
      { name: "description", content: "Snap, upload or bulk-import receipts and let AI capture vendor, date, GST/HST and total." },
      { property: "og:title", content: "Scan a receipt — JobLedger" },
      { property: "og:description", content: "AI receipt capture with Canadian tax handling and bulk import." },
    ],
  }),
  component: ScanPage,
});

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);
const PAYMENTS = ["cash", "credit_card", "debit_card", "etransfer", "cheque", "other"];
const MAX_BULK = 25;

type BulkItem = { name: string; state: "queued" | "working" | "done" | "error"; message?: string };

function ScanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: projects = [] } = useProjects(user?.id);
  const extract = useServerFn(extractReceipt);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "uploading" | "reading" | "saving">("idle");
  const [bulk, setBulk] = useState<BulkItem[] | null>(null);

  async function processFile(file: File, source: "scan" | "bulk") {
    if (!user) throw new Error("You need to be signed in.");
    const dataUrl = await toDataUrl(file);
    if (source === "scan") setPreview(dataUrl);

    if (source === "scan") setStep("uploading");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("receipts").upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (up.error) throw up.error;

    if (source === "scan") setStep("reading");
    const ai = await extract({
      data: {
        imageDataUrl: dataUrl,
        mode: profile?.mode === "job" ? "job" : "expense",
        categories: CATEGORY_VALUES,
        projects: projects.map((p) => ({ id: p.id, name: p.name, customer: p.customer })),
      },
    });

    if (source === "scan") setStep("saving");
    const category = (CATEGORY_VALUES as string[]).includes(ai.category ?? "")
      ? (ai.category as ExpenseCategory)
      : "other";
    const payment = PAYMENTS.includes(ai.payment_method ?? "") ? (ai.payment_method as PaymentMethod) : null;
    const projectId =
      ai.suggested_project_id && projects.some((p) => p.id === ai.suggested_project_id)
        ? ai.suggested_project_id
        : null;

    const warnings = validateReceipt(
      {
        subtotal: ai.subtotal,
        gst_hst: ai.gst_hst,
        other_tax: ai.other_tax,
        total: ai.total,
        receipt_date: ai.receipt_date,
        vendor: ai.vendor,
        project_id: projectId,
      },
      profile?.mode === "job" ? "job" : "expense",
    );

    const { data: inserted, error } = await supabase
      .from("receipts")
      .insert({
        user_id: user.id,
        image_path: path,
        vendor: ai.vendor,
        receipt_date: ai.receipt_date,
        currency: ai.currency || "CAD",
        subtotal: ai.subtotal,
        gst_hst: ai.gst_hst,
        other_tax: ai.other_tax,
        total: ai.total ?? 0,
        receipt_number: ai.receipt_number,
        payment_method: payment,
        category,
        project_id: projectId,
        review_status: "needs_review",
        warnings,
        ai_confidence: ai.confidence,
        notes: ai.notes_for_reviewer,
        source,
      })
      .select("id")
      .single();
    if (error) throw error;
    return inserted.id;
  }

  async function handleFile(file: File) {
    try {
      const id = await processFile(file, "scan");
      navigate({ to: "/receipts/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong reading that receipt.");
      setStep("idle");
    }
  }

  async function handleBulk(files: File[]) {
    const list = files.slice(0, MAX_BULK);
    if (files.length > MAX_BULK) toast.message(`Only the first ${MAX_BULK} images will be imported.`);
    setBulk(list.map((f) => ({ name: f.name, state: "queued" as const })));
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      setBulk((prev) => prev?.map((it, idx) => (idx === i ? { ...it, state: "working" } : it)) ?? prev);
      try {
        await processFile(list[i]!, "bulk");
        ok += 1;
        setBulk((prev) => prev?.map((it, idx) => (idx === i ? { ...it, state: "done" } : it)) ?? prev);
      } catch (e) {
        setBulk((prev) =>
          prev?.map((it, idx) =>
            idx === i
              ? { ...it, state: "error", message: e instanceof Error ? e.message : "Failed" }
              : it,
          ) ?? prev,
        );
      }
    }
    toast.success(`${ok} of ${list.length} receipts imported. Review them in the vault.`);
  }

  const bulkRunning = !!bulk?.some((b) => b.state === "queued" || b.state === "working");
  const busy = step !== "idle" || bulkRunning;
  const doneCount = bulk?.filter((b) => b.state === "done" || b.state === "error").length ?? 0;

  return (
    <AppShell title="Scan a receipt" subtitle="Photo in, structured expense out.">
      <div className="panel overflow-hidden">
        <div className="flex aspect-[4/3] items-center justify-center bg-muted">
          {preview ? (
            <img src={preview} alt="Receipt preview" className="h-full w-full object-contain" />
          ) : (
            <div className="px-6 text-center text-sm text-muted-foreground">
              <Camera className="mx-auto mb-3 size-10 opacity-50" />
              Lay the receipt flat, fill the frame, avoid shadows.
            </div>
          )}
        </div>
        <div className="space-y-3 p-4">
          {step !== "idle" ? (
            <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              <Loader2 className="size-4 animate-spin" />
              {step === "uploading"
                ? "Uploading image…"
                : step === "reading"
                  ? "Reading receipt with AI…"
                  : "Saving expense…"}
            </div>
          ) : null}
          <Button className="w-full" size="lg" disabled={busy} onClick={() => cameraRef.current?.click()}>
            <Camera /> Take photo
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImageUp /> Upload from library
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => bulkRef.current?.click()}>
            <Layers /> Bulk import (up to {MAX_BULK})
          </Button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <input
            ref={bulkRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) void handleBulk(files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {bulk ? (
        <div className="panel mt-4 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Bulk import</span>
            <span className="text-muted-foreground">
              {doneCount}/{bulk.length}
            </span>
          </div>
          <ul className="space-y-1 text-xs">
            {bulk.map((b, i) => (
              <li key={`${b.name}-${i}`} className="flex items-center justify-between gap-3">
                <span className="truncate">{b.name}</span>
                <span
                  className={
                    b.state === "error"
                      ? "shrink-0 text-destructive"
                      : b.state === "done"
                        ? "shrink-0 text-primary"
                        : "shrink-0 text-muted-foreground"
                  }
                >
                  {b.state === "working" ? "reading…" : b.state === "done" ? "imported" : b.state === "error" ? (b.message ?? "failed") : "queued"}
                </span>
              </li>
            ))}
          </ul>
          {!bulkRunning ? (
            <Button variant="outline" className="mt-3 w-full" onClick={() => navigate({ to: "/receipts" })}>
              Review imported receipts
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        You review every extracted field before it counts toward a job.
      </p>
    </AppShell>
  );
}

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}
