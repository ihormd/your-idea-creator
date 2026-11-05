// Server-only OCR quota: one AI extraction = one unit, per scope per day.
// Scope "user" covers the in-app scan button (per logged-in user); scope
// "business" covers the inbound-email webhook (per business).
// Counts live in public.ocr_usage and are only touched with the service-role
// key, so clients cannot reset their own quota. Concurrent calls can slip
// past the limit by a unit or two; at pilot scale that is acceptable.
// The limit is a single constant so a tariff can change it in one place.

export const DAILY_OCR_LIMIT = 50;

export async function consumeOcrQuota(
  scope: "user" | "business",
  scopeId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("ocr_usage")
    .select("count")
    .eq("scope", scope)
    .eq("scope_id", scopeId)
    .eq("day", today)
    .maybeSingle();
  if (error) throw error;

  const used = data?.count ?? 0;
  if (used >= DAILY_OCR_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  const { error: upsertError } = await supabaseAdmin
    .from("ocr_usage")
    .upsert(
      { scope, scope_id: scopeId, day: today, count: used + 1 },
      { onConflict: "scope,scope_id,day" },
    );
  if (upsertError) throw upsertError;

  return { allowed: true, remaining: DAILY_OCR_LIMIT - used - 1 };
}
