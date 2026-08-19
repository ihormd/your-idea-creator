import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  imageDataUrl: z.string().min(32),
  mode: z.enum(["job", "expense"]).default("expense"),
  categories: z.array(z.string()).default([]),
  projects: z.array(z.object({ id: z.string(), name: z.string(), customer: z.string().nullable() })).default([]),
});

export type ExtractedReceipt = {
  vendor: string | null;
  receipt_date: string | null;
  currency: string;
  subtotal: number | null;
  gst_hst: number | null;
  other_tax: number | null;
  total: number | null;
  receipt_number: string | null;
  payment_method: string | null;
  category: string | null;
  suggested_project_id: string | null;
  confidence: Record<string, number>;
  notes_for_reviewer: string | null;
};

export const extractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ExtractedReceipt> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app.");

    const projectList = data.projects.length
      ? data.projects.map((p) => `${p.id} = ${p.name}${p.customer ? ` (${p.customer})` : ""}`).join("\n")
      : "none";

    const system = [
      "You extract data from photos of Canadian business receipts and invoices.",
      "Only report values that are actually printed on the document. Never invent or compute missing financial values.",
      "Dates must be ISO YYYY-MM-DD. Amounts must be plain numbers without currency symbols.",
      "GST/HST goes in gst_hst. PST/QST or any other tax goes in other_tax.",
      "Give a confidence between 0 and 1 for each of: vendor, receipt_date, subtotal, gst_hst, total.",
      `Choose category from: ${data.categories.join(", ")}.`,
      data.mode === "job"
        ? `Suggest the most likely project id from this list, or null if unclear:\n${projectList}`
        : "suggested_project_id must be null.",
      "Return JSON only.",
    ].join("\n");

    const body = {
      model: "google/gemini-3.7-flash",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract this receipt." },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "receipt",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "vendor",
              "receipt_date",
              "currency",
              "subtotal",
              "gst_hst",
              "other_tax",
              "total",
              "receipt_number",
              "payment_method",
              "category",
              "suggested_project_id",
              "confidence",
              "notes_for_reviewer",
            ],
            properties: {
              vendor: { type: ["string", "null"] },
              receipt_date: { type: ["string", "null"] },
              currency: { type: "string" },
              subtotal: { type: ["number", "null"] },
              gst_hst: { type: ["number", "null"] },
              other_tax: { type: ["number", "null"] },
              total: { type: ["number", "null"] },
              receipt_number: { type: ["string", "null"] },
              payment_method: { type: ["string", "null"] },
              category: { type: ["string", "null"] },
              suggested_project_id: { type: ["string", "null"] },
              notes_for_reviewer: { type: ["string", "null"] },
              confidence: {
                type: "object",
                additionalProperties: false,
                required: ["vendor", "receipt_date", "subtotal", "gst_hst", "total"],
                properties: {
                  vendor: { type: "number" },
                  receipt_date: { type: "number" },
                  subtotal: { type: "number" },
                  gst_hst: { type: "number" },
                  total: { type: "number" },
                },
              },
            },
          },
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI is busy right now. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits are exhausted. Add credits in Lovable to keep scanning.");
      throw new Error(`Receipt reading failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: ExtractedReceipt;
    try {
      parsed = JSON.parse(content) as ExtractedReceipt;
    } catch {
      throw new Error("Could not read the receipt. Try a clearer photo.");
    }
    return parsed;
  });
