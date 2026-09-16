import * as React from "react";

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
}

/**
 * `loading` is the state the statically exported HTML is built in, so the
 * dashboard never appears in the markup — the gate in src/app/page.tsx resolves
 * it on the client against /api/auth/me before rendering anything else.
 */
export type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: SessionUser };

interface MeResponse {
  authenticated: boolean;
  user?: SessionUser;
}

export function useSession() {
  const [session, setSession] = React.useState<SessionState>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const data: MeResponse | null = res.ok ? await res.json() : null;
        if (cancelled) return;
        setSession(
          data?.authenticated && data.user
            ? { status: "authenticated", user: data.user }
            : { status: "anonymous" },
        );
      } catch {
        // No Worker behind the page (plain `next dev`) or the network is down.
        // Either way there is no session to show the dashboard for.
        if (!cancelled) setSession({ status: "anonymous" });
      }
    }
    check();

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // The cookie may survive, but dropping back to the login screen is still
      // the right thing to show — the next /api/auth/me settles it either way.
    }
    setSession({ status: "anonymous" });
  }, []);

  return { session, signOut };
}
