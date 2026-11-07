import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek } from "./desk";

export const DIAL_TEXTS = ["No answer", "Left voicemail", "Talked"];

export function useWeekStats(userId: string) {
  return useQuery({
    queryKey: ["weekStats", userId],
    queryFn: async () => {
      const since = startOfWeek().toISOString();
      const [{ data: leads }, { count: numbers }] = await Promise.all([
        supabase
          .from("leads")
          .select("stage_at, log")
          .eq("user_id", userId)
          .or(`updated_at.gte.${since},created_at.gte.${since}`),
        supabase
          .from("phone_numbers")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);
      let appts = 0,
        apps = 0,
        dials = 0;
      for (const l of leads ?? []) {
        for (const e of (l.log ?? []) as { at: string; text: string }[]) {
          if (e.at >= since && DIAL_TEXTS.includes(e.text)) dials++;
        }
        const s = (l.stage_at ?? {}) as Record<string, string>;
        if (s["appointment"] && s["appointment"] >= since) appts++;
        if (s["application"] && s["application"] >= since) apps++;
      }
      return { dials, appts, apps, numbers: numbers ?? 0 };
    },
  });
}
