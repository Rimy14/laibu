"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, authBase, hasSessionHint, SESSION_ENDED_EVENT, TERMS_REQUIRED_EVENT } from "./api";

export type Role = "author" | "publisher" | "buyer" | "superadmin";

export interface User {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
  room_unlocked: boolean;
  room_slug: string | null;
  created_at: string;
}

type Status = "loading" | "authenticated" | "anonymous";

interface SessionValue {
  status: Status;
  user: User | null;
  termsCurrent: boolean;
  /** Re-reads /api/me (after login, profile edits, terms acceptance). */
  reload: () => Promise<void>;
  /** Called with the API response after sign-in / sign-up. */
  signedIn: (data: { user: User; terms_current: boolean }) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [termsCurrent, setTermsCurrent] = useState(true);

  const reload = useCallback(async () => {
    if (!hasSessionHint()) {
      setUser(null);
      setStatus("anonymous");
      return;
    }
    try {
      const me = await api<{ user: User; terms_current: boolean }>("/me");
      setUser(me.user);
      setTermsCurrent(me.terms_current);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    // Run after mount: the session hint cookie only exists in the browser.
    const t = setTimeout(() => void reload(), 0);
    const onEnded = () => {
      setUser(null);
      setStatus("anonymous");
    };
    const onTerms = () => setTermsCurrent(false);
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    window.addEventListener(TERMS_REQUIRED_EVENT, onTerms);
    return () => {
      clearTimeout(t);
      window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
      window.removeEventListener(TERMS_REQUIRED_EVENT, onTerms);
    };
  }, [reload]);

  const signedIn = useCallback((data: { user: User; terms_current: boolean }) => {
    setUser(data.user);
    setTermsCurrent(data.terms_current);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api(`${authBase()}/logout`, { method: "POST" });
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, termsCurrent, reload, signedIn, signOut }),
    [status, user, termsCurrent, reload, signedIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

export const ROLE_LABEL: Record<Role, string> = {
  author: "Author",
  publisher: "Publisher",
  buyer: "Reader",
  superadmin: "Superadmin",
};
