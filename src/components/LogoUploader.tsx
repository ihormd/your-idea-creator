import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { BrandAvatar } from "@/components/BrandAvatar";
import { Button } from "@/components/ui/button";
import { useRemoveLogo, useUploadLogo } from "@/lib/queries";

export function LogoUploader({
  userId,
  logoPath,
  name,
}: {
  userId: string | undefined;
  logoPath: string | null | undefined;
  name: string | null | undefined;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadLogo(userId);
  const remove = useRemoveLogo(userId);
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Please choose an image under 3 MB.");
      return;
    }
    setBusy(true);
    try {
      await upload.mutateAsync(file);
      toast.success("Logo updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <BrandAvatar logoPath={logoPath} name={name} className="size-16 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Logo or photo</p>
        <p className="text-xs text-muted-foreground">
          Shown beside your business name and on exports. Square images look best.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            <ImagePlus /> {logoPath ? "Replace" : "Upload"}
          </Button>
          {logoPath ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await remove.mutateAsync(logoPath);
                  toast.success("Logo removed.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 /> Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
