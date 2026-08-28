import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Business, MembershipRole } from "@/lib/domain";

const ACTIVE_BUSINESS_KEY = "active_business_id";

export type MembershipWithBusiness = {
  business_id: string;
  role: MembershipRole;
  business: Business;
};

// A user can belong to more than one business now (an accountant invited to
// several clients' books, or someone who owns one business and also
// accounts for another). This resolves "which business is active right
// now" — defaulting to whichever was last picked, or the first one — and
// exposes the full list so a switcher UI can offer the rest.
export function useMemberships() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MembershipWithBusiness[]> => {
      const { data, error } = await supabase
        .from("memberships")
        .select("business_id, role, business:businesses(*)")
        .eq("user_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []).filter((m) => m.business) as unknown as MembershipWithBusiness[];
    },
  });
}

export function useBusiness() {
  const { data: memberships, isLoading } = useMemberships();
  const queryClient = useQueryClient();
  const [activeId, setActiveIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(ACTIVE_BUSINESS_KEY),
  );

  useEffect(() => {
    if (!memberships || memberships.length === 0) return;
    const stillValid = memberships.some((m) => m.business_id === activeId);
    if (!stillValid) {
      const first = memberships[0]!.business_id;
      setActiveIdState(first);
      localStorage.setItem(ACTIVE_BUSINESS_KEY, first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships]);

  const setActiveBusinessId = (id: string) => {
    localStorage.setItem(ACTIVE_BUSINESS_KEY, id);
    setActiveIdState(id);
    void queryClient.invalidateQueries();
  };

  const active = useMemo(
    () => memberships?.find((m) => m.business_id === activeId) ?? memberships?.[0] ?? null,
    [memberships, activeId],
  );

  return {
    loading: isLoading,
    memberships: memberships ?? [],
    businessId: active?.business_id ?? null,
    business: active?.business ?? null,
    role: active?.role ?? null,
    hasAnyBusiness: (memberships?.length ?? 0) > 0,
    setActiveBusinessId,
  };
}
