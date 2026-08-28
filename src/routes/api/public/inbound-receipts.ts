import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Inbound email receiver. Point your inbound-email provider (Mailgun routes,
// SendGrid Inbound Parse, Postmark, CloudMailin, Zapier…) at this URL and have
// it POST JSON in the shape below, authenticated with the project's
// publishable key in the `apikey` header or an `?apikey=` query param.
const Payload = z.object({
  to: z.string().min(3),
  from: z.string().optional().default(""),
  subject: z.string().optional().default(""),
  attachments: z
    .array(
      z.object({
        filename: z.string().optional().default("receipt.jpg"),
        content_type: z.string().optional().default("image/jpeg"),
        content_base64: z.string().min(32),
      }),
    )
    .default([]),
});

const MAX_ATTACHMENTS = 5;
const MAX_BYTES = 8 * 1024 * 1024;
const CATEGORY_VALUES = [
  "materials",
  "fuel",
  "tools",
  "equipment",
  "subcontractors",
  "permits",
  "travel",
  "meals",
  "other",
];
const PAYMENTS = ["cash", "credit_card", "debit_card", "etransfer", "cheque", "other"];

function aliasFromAddress(to: string) {
  const match = to.match(/([A-Za-z0-9._%+-]+)@/);
  const local = (match?.[1] ?? to).toLowerCase();
  // strip plus-addressing suffix
  return local.split("+")[0]!;
}

export const Route = createFileRoute("/api/public/inbound-receipts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const url = new URL(request.url);
        const provided = request.headers.get("apikey") ?? url.searchParams.get("apikey");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: z.infer<typeof Payload>;
        try {
          payload = Payload.parse(await request.json());
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const alias = aliasFromAddress(payload.to);

        const { data: aliasRow } = await supabaseAdmin
          .from("inbound_aliases")
          .select("business_id, active")
          .eq("alias", alias)
          .maybeSingle();

        if (!aliasRow || !aliasRow.active) {
          await supabaseAdmin.from("inbound_emails").insert({
            alias,
            from_email: payload.from,
            subject: payload.subject,
            attachments_count: payload.attachments.length,
            status: "ignored",
            error: "Unknown or inactive forwarding address",
          });
          return Response.json({ ok: false, reason: "unknown_alias" }, { status: 202 });
        }

        const businessId = aliasRow.business_id;
        const images = payload.attachments
          .filter(
            (a) =>
              a.content_type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(a.filename),
          )
          .slice(0, MAX_ATTACHMENTS);

        const [{ data: business }, { data: projects }] = await Promise.all([
          supabaseAdmin.from("businesses").select("mode").eq("id", businessId).maybeSingle(),
          supabaseAdmin
            .from("projects")
            .select("id, name, customer")
            .eq("business_id", businessId)
            .eq("status", "active"),
        ]);
        const mode = business?.mode === "job" ? "job" : "expense";

        const { extractReceiptFromImage } = await import("@/lib/receipt-extract.server");
        const { validateReceipt } = await import("@/lib/domain");

        let created = 0;
        let failure: string | null = null;

        for (const att of images) {
          try {
            const bytes = Uint8Array.from(atob(att.content_base64.replace(/\s/g, "")), (c) =>
              c.charCodeAt(0),
            );
            if (bytes.byteLength > MAX_BYTES) throw new Error("Attachment too large");
            const dataUrl = `data:${att.content_type};base64,${att.content_base64.replace(/\s/g, "")}`;
            const ext = (att.filename.split(".").pop() || "jpg").toLowerCase();
            const path = `${businessId}/${crypto.randomUUID()}.${ext}`;

            const up = await supabaseAdmin.storage
              .from("receipts")
              .upload(path, bytes, { contentType: att.content_type, upsert: false });
            if (up.error) throw up.error;

            const ai = await extractReceiptFromImage({
              imageDataUrl: dataUrl,
              mode,
              categories: CATEGORY_VALUES,
              projects: (projects ?? []).map((p) => ({
                id: p.id,
                name: p.name,
                customer: p.customer,
              })),
            });

            const category = CATEGORY_VALUES.includes(ai.category ?? "") ? ai.category! : "other";
            const payment = PAYMENTS.includes(ai.payment_method ?? "") ? ai.payment_method! : null;
            const projectId =
              ai.suggested_project_id &&
              (projects ?? []).some((p) => p.id === ai.suggested_project_id)
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
              mode,
            );

            let duplicateOf: string | null = null;
            if (ai.vendor && ai.total) {
              const { data: candidates } = await supabaseAdmin
                .from("receipts")
                .select("id, receipt_date, total")
                .eq("business_id", businessId)
                .ilike("vendor", ai.vendor)
                .eq("total", ai.total)
                .is("duplicate_of", null)
                .limit(5);
              const match = (candidates ?? []).find((c) => {
                if (!ai.receipt_date || !c.receipt_date) return true;
                const days =
                  Math.abs(
                    new Date(ai.receipt_date).getTime() - new Date(c.receipt_date).getTime(),
                  ) / 86400000;
                return days <= 3;
              });
              if (match) {
                duplicateOf = match.id;
                warnings.push(
                  "Possible duplicate — a receipt with the same vendor and total is already in your vault.",
                );
              }
            }

            const { error } = await supabaseAdmin.from("receipts").insert({
              business_id: businessId,
              image_path: path,
              vendor: ai.vendor,
              receipt_date: ai.receipt_date,
              currency: ai.currency || "CAD",
              subtotal: ai.subtotal,
              gst_hst: ai.gst_hst,
              other_tax: ai.other_tax,
              total: ai.total ?? 0,
              receipt_number: ai.receipt_number,
              payment_method: payment as never,
              category: category as never,
              project_id: projectId,
              review_status: "needs_review",
              warnings,
              duplicate_of: duplicateOf,
              ai_confidence: ai.confidence,
              notes: ai.notes_for_reviewer,
              source: "email",
            });
            if (error) throw error;
            created += 1;
          } catch (e) {
            failure = e instanceof Error ? e.message : "Attachment failed";
            console.error("[inbound-receipts]", failure);
          }
        }

        await supabaseAdmin.from("inbound_emails").insert({
          business_id: businessId,
          alias,
          from_email: payload.from,
          subject: payload.subject,
          attachments_count: payload.attachments.length,
          receipts_created: created,
          status: created > 0 ? "processed" : images.length === 0 ? "ignored" : "failed",
          error: created === images.length ? null : failure,
        });

        return Response.json({ ok: true, receipts_created: created });
      },
    },
  },
});
