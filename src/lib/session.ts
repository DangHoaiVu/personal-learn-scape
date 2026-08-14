import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  name: string;
  role: "student" | "teacher";
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,role")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile) ?? null;
    },
    staleTime: 60_000,
  });
}
