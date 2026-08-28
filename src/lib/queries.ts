import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Business, Project, Receipt } from "./domain";

export function useBusinessRow(businessId?: string | null) {
  return useQuery({
    queryKey: ["business", businessId],
    enabled: !!businessId,
    queryFn: async (): Promise<Business | null> => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", businessId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateBusiness(businessId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Business>) => {
      const { error } = await supabase.from("businesses").update(patch).eq("id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["business"] });
      void qc.invalidateQueries({ queryKey: ["memberships"] });
    },
  });
}

export function useProjects(businessId?: string | null) {
  return useQuery({
    queryKey: ["projects", businessId],
    enabled: !!businessId,
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReceipts(businessId?: string | null) {
  return useQuery({
    queryKey: ["receipts", businessId],
    enabled: !!businessId,
    queryFn: async (): Promise<Receipt[]> => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("business_id", businessId!)
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
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
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
      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["receipts"] });
  void qc.invalidateQueries({ queryKey: ["receipt"] });
  void qc.invalidateQueries({ queryKey: ["projects"] });
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

export function useUploadLogo(businessId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${businessId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { error: bErr } = await supabase
        .from("businesses")
        .update({ logo_path: path })
        .eq("id", businessId!);
      if (bErr) throw bErr;
      return path;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["business"] });
      void qc.invalidateQueries({ queryKey: ["signed-file"] });
    },
  });
}

export function useRemoveLogo(businessId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (path: string | null) => {
      if (path) await supabase.storage.from("branding").remove([path]);
      const { error } = await supabase
        .from("businesses")
        .update({ logo_path: null })
        .eq("id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["business"] });
      void qc.invalidateQueries({ queryKey: ["signed-file"] });
    },
  });
}
