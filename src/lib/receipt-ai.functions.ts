import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExtractedReceipt } from "./receipt-extract.server";

export type { ExtractedReceipt };

const Input = z.object({
  imageDataUrl: z.string().min(32),
  mode: z.enum(["job", "expense"]).default("expense"),
  categories: z.array(z.string()).default([]),
  projects: z.array(z.object({ id: z.string(), name: z.string(), customer: z.string().nullable() })).default([]),
});

export const extractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ExtractedReceipt> => {
    const { extractReceiptFromImage } = await import("./receipt-extract.server");
    return extractReceiptFromImage(data);
  });
