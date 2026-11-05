import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExtractedReceipt } from "./receipt-extract.server";

export type { ExtractedReceipt };

const Input = z.object({
  imageDataUrl: z.string().min(32),
  mode: z.enum(["job", "expense"]).default("expense"),
  categories: z.array(z.string()).default([]),
  projects: z
    .array(z.object({ id: z.string(), name: z.string(), customer: z.string().nullable() }))
    .default([]),
});

export const extractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }): Promise<ExtractedReceipt> => {
    const { consumeOcrQuota } = await import("./ocr-quota.server");
    const quota = await consumeOcrQuota("user", context.userId);
    if (!quota.allowed) {
      throw new Error("Daily scan limit reached (50 scans/day). Please try again tomorrow.");
    }
    const { extractReceiptFromImage } = await import("./receipt-extract.server");
    return extractReceiptFromImage(data);
  });
