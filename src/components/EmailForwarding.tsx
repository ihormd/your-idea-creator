import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/domain";

const INBOX_DOMAIN = "receipts.jobledger.app";

function randomAlias() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (const b of bytes) out += chars[b % chars.length];
  return `rcpt-${out}`;
}

export function EmailForwarding({ userId }: { userId: string | undefined }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const alias = useQuery({
    queryKey: ["inbound-alias", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_aliases")
        .select("alias, active")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const emails = useQuery({
    queryKey: ["inbound-emails", userId],
    enabled: !!userId && !!alias.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_emails")
        .select("id, from_email, subject, receipts_created, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("inbound_aliases")
        .insert({ user_id: userId!, alias: randomAlias() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbound-alias"] }),
  });

  const toggle = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await supabase.from("inbound_aliases").update({ active }).eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbound-alias"] }),
  });

  const address = alias.data ? `${alias.data.alias}@${INBOX_DOMAIN}` : null;

  return (
    <div className="panel mt-4 space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-primary" />
        <h2 className="font-medium">Email forwarding</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Forward supplier receipts and invoices to your private address. Image attachments are read by AI and land in your
        vault as receipts to review.
      </p>

      {!alias.data ? (
        <Button
          className="w-full"
          disabled={busy || !userId}
          onClick={async () => {
            setBusy(true);
            try {
              await create.mutateAsync();
              toast.success("Forwarding address created.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not create the address.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Create my forwarding address
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-sm">{address}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(address!);
                toast.success("Address copied.");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={alias.data.active ? "text-primary" : "text-muted-foreground"}>
              {alias.data.active ? "Active" : "Paused"}
            </span>
            <Button size="sm" variant="outline" onClick={() => toggle.mutate(!alias.data!.active)}>
              {alias.data.active ? "Pause" : "Resume"}
            </Button>
          </div>

          {emails.data && emails.data.length > 0 ? (
            <ul className="space-y-2 border-t border-border pt-3 text-xs">
              {emails.data.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{e.subject || "(no subject)"}</p>
                    <p className="truncate text-muted-foreground">
                      {e.from_email || "unknown sender"} · {formatDate(e.created_at)}
                    </p>
                  </div>
                  <span className={e.status === "processed" ? "shrink-0 text-primary" : "shrink-0 text-muted-foreground"}>
                    {e.receipts_created} receipt{e.receipts_created === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No forwarded emails yet.</p>
          )}
        </>
      )}
    </div>
  );
}
