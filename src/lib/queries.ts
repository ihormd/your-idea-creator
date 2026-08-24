import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Project, Receipt } from "./domain";

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useProjects(userId?: string) {
  return useQuery({
    queryKey: ["projects", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReceipts(userId?: string) {
  return useQuery({
    queryKey: ["receipts", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Receipt[]> => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .order("receipt_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReceipt(id?: string) {
  return useQuery({
    queryKey: ["receipt", id],
    enabled: !!id,
    queryFn: async (): Promise<Receipt | null> => {
      const { data, error } = await supabase.from("receipts").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSignedImage(path: string | null | undefined) {
  return useQuery({
    queryKey: ["receipt-image", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["receipts"] });
  qc.invalidateQueries({ queryKey: ["receipt"] });
  qc.invalidateQueries({ queryKey: ["projects"] });
}

export function useSignedFile(bucket: string, path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-file", bucket, path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function useUploadLogo(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${userId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
      if (error) throw error;
      const { error: pErr } = await supabase.from("profiles").update({ logo_path: path }).eq("id", userId!);
      if (pErr) throw pErr;
      return path;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["signed-file"] });
    },
  });
}

export function useRemoveLogo(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (path: string | null) => {
      if (path) await supabase.storage.from("branding").remove([path]);
      const { error } = await supabase.from("profiles").update({ logo_path: null }).eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["signed-file"] });
    },
  });
}
