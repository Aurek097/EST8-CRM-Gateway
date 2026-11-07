import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Role = "admin" | "agent";

export const accessQuery = queryOptions({
  queryKey: ["access"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    const roleList = (roles ?? []).map((r) => r.role as Role);
    return {
      user,
      profile: profile as Profile | null,
      roles: roleList,
      isAdmin: roleList.includes("admin"),
      hasAccess: roleList.length > 0 && !!profile?.is_active,
    };
  },
});

/** Monday 00:00 local time of the current week. */
export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

type DeskCtx = {
  me: Profile;
  isAdmin: boolean;
  /** Whose book is open. Equals me.id on My Desk. */
  bookUserId: string;
  bookName: string | null;
  openBook: (userId: string, name: string | null) => void;
};

const Ctx = createContext<DeskCtx | null>(null);
const KEY = "est8.viewingBook";

export function DeskProvider({
  me,
  isAdmin,
  children,
}: {
  me: Profile;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const [book, setBook] = useState<{ id: string; name: string | null }>({ id: me.id, name: null });

  useEffect(() => {
    if (!isAdmin) return;
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      try {
        setBook(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
  }, [isAdmin]);

  const openBook = (id: string, name: string | null) => {
    const next = id === me.id ? { id: me.id, name: null } : { id, name };
    setBook(next);
    if (id === me.id) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(next));
  };

  return (
    <Ctx.Provider
      value={{
        me,
        isAdmin,
        bookUserId: isAdmin ? book.id : me.id,
        bookName: isAdmin ? book.name : null,
        openBook,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDesk() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDesk must be used inside DeskProvider");
  return ctx;
}

export function initials(name?: string | null, email?: string | null) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "";
    return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return "AG";
}
