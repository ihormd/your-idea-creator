import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ImageUp, Loader2 } from "lucide-react";
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
      { name: "description", content: "Snap or upload a receipt and let AI capture vendor, date, GST/HST and total." },
      { property: "og:title", content: "Scan a receipt — JobLedger" },
      { property: "og:description", content: "AI receipt capture with Canadian tax handling." },
    ],
  }),
  component: ScanPage,
});

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);
const PAYMENTS = ["cash", "credit_card", "debit_card", "etransfer", "cheque", "other"];

function ScanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: projects = [] } = useProjects(user?.id);
  const extract = useServerFn(extractReceipt);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "uploading" | "reading" | "saving">("idle");

  async function handleFile(file: File) {
    if (!user) return;
    const dataUrl = await toDataUrl(file);
    setPreview(dataUrl);
    try {
      setStep("uploading");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("receipts").upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (up.error) throw up.error;

      setStep("reading");
      const ai = await extract({
        data: {
          imageDataUrl: dataUrl,
          mode: profile?.mode === "job" ? "job" : "expense",
          categories: CATEGORY_VALUES,
          projects: projects.map((p) => ({ id: p.id, name: p.name, customer: p.customer })),
        },
      });

      setStep("saving");
      const category = (CATEGORY_VALUES as string[]).includes(ai.category ?? "")
        ? (ai.category as ExpenseCategory)
        : "other";
      const payment = PAYMENTS.includes(ai.payment_method ?? "")
        ? (ai.payment_method as PaymentMethod)
        : null;
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
        })
        .select("id")
        .single();
      if (error) throw error;

      navigate({ to: "/receipts/$id", params: { id: inserted.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong reading that receipt.");
      setStep("idle");
    }
  }

  const busy = step !== "idle";

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
          {busy ? (
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
        </div>
      </div>
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
