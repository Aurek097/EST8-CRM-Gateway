import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useDesk } from "./desk";
import type { LeadRow } from "./leads";

export const leadsKey = (uid: string) => ["leads", uid] as const;

export function useLeads() {
  const { bookUserId } = useDesk();
  return useQuery({
    queryKey: leadsKey(bookUserId),
    queryFn: async () => {
      const all: LeadRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("user_id", bookUserId)
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });
}

export function useLeadActions() {
  const { bookUserId } = useDesk();
  const qc = useQueryClient();
  const key = leadsKey(bookUserId);
  const refreshStats = () => qc.invalidateQueries({ queryKey: ["weekStats", bookUserId] });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LeadRow> }) => {
      const { data, error } = await supabase
        .from("leads")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LeadRow[]>(key);
      qc.setQueryData<LeadRow[]>(key, (old) =>
        old?.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error("Couldn't save that change");
    },
    onSettled: refreshStats,
  });

  const insertMany = async (rows: Omit<TablesInsert<"leads">, "user_id">[]) => {
    const withUser = rows.map((r) => ({ ...r, user_id: bookUserId }));
    for (let i = 0; i < withUser.length; i += 500) {
      const { error } = await supabase.from("leads").insert(withUser.slice(i, i + 500));
      if (error) throw error;
    }
    await qc.invalidateQueries({ queryKey: key });
    refreshStats();
  };

  const remove = async (ids: string[]) => {
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (error) {
      toast.error("Couldn't delete");
      return;
    }
    qc.setQueryData<LeadRow[]>(key, (old) => old?.filter((l) => !ids.includes(l.id)));
    refreshStats();
  };

  return {
    update: (id: string, patch: Partial<LeadRow>) => update.mutate({ id, patch }),
    insertMany,
    remove,
  };
}
