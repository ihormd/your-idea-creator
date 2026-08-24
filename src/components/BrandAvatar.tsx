import { Building2 } from "lucide-react";
import { useSignedFile } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function initialsOf(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Business logo (or initials fallback) shown beside the company name. */
export function BrandAvatar({
  logoPath,
  name,
  className,
}: {
  logoPath?: string | null;
  name?: string | null;
  className?: string;
}) {
  const { data: url } = useSignedFile("branding", logoPath);
  const initials = initialsOf(name);

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary text-sm font-semibold text-secondary-foreground",
        className,
      )}
      aria-hidden={!name}
    >
      {url ? (
        <img src={url} alt={name ? `${name} logo` : "Business logo"} className="size-full object-cover" />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <Building2 className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
