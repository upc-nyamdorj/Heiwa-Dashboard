import * as React from "react";

export type Role = "viewer" | "editor" | "admin";

export interface Account {
  id: string;
  username: string;
  role: Role;
}

export type AccountState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "signedIn"; user: Account };

const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };

/** Roles are cumulative — mirrors atLeast() in worker/auth-session.ts. */
export function atLeast(user: Account | null, role: Role): boolean {
  return !!user && RANK[user.role] >= RANK[role];
}

export function useAccount() {
  const [session, setSession] = React.useState<AccountState>({ status: "loading" });

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/session/me", { credentials: "same-origin" });
      const data = res.ok ? await res.json() : null;
      return data?.authenticated && data.user
        ? ({ status: "signedIn", user: data.user } as const)
        : ({ status: "anonymous" } as const);
    } catch {
      // No Worker behind the page (plain `next dev`), or the network is down.
      return { status: "anonymous" } as const;
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    refresh().then((next) => { if (!cancelled) setSession(next); });
    return () => { cancelled = true; };
  }, [refresh]);

  const signIn = React.useCallback(async () => {
    setSession(await refresh());
  }, [refresh]);

  const signOut = React.useCallback(async () => {
    try {
      await fetch("/api/session/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Dropping to the login screen is still the right thing to show.
    }
    setSession({ status: "anonymous" });
  }, []);

  return { session, signIn, signOut };
}
