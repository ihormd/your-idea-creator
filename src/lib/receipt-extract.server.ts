// Server-only receipt extraction core, shared by the scan server function
// and the inbound-email webhook.
//
// Calls Google Gemini (free tier) through its OpenAI-compatible endpoint,
// with your own API key from Google AI Studio — no paid account needed.
// If you'd rather use a different provider, only this function needs to
// change: swap the endpoint/model/auth below, the request body is already
// OpenAI-compatible (most providers — Groq, OpenRouter, Azure OpenAI —
// accept this exact shape with just a different base URL).

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

export type ExtractInput = {
  imageDataUrl: string;
  mode: "job" | "expense";
  categories: string[];
  projects: { id: string; name: string; customer: string | null }[];
};

export async function extractReceiptFromImage(data: ExtractInput): Promise<ExtractedReceipt> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("AI is not configured for this app.");

  const projectList = data.projects.length
    ? data.projects
        .map((p) => `${p.id} = ${p.name}${p.customer ? ` (${p.customer})` : ""}`)
        .join("\n")
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
    model: "gemini-2.5-flash",
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
    // Gemini's OpenAI-compatible endpoint supports plain JSON-object mode;
    // the strict JSON-schema mode is an OpenAI-only feature, so it is not
    // sent here. The system prompt already says "Return JSON only" and the
    // response is parsed with a fallback error below.
    response_format: {
      type: "json_object",
    },
  };

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI is busy right now. Please try again in a moment.");
    if (res.status === 402 || res.status === 401)
      throw new Error("AI is not available right now — check the AI API key.");
    throw new Error(`Receipt reading failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as ExtractedReceipt;
  } catch {
    throw new Error("Could not read the receipt. Try a clearer photo.");
  }
}
