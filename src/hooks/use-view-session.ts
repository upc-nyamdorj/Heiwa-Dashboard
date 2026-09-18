import * as React from "react";

/**
 * Whether the viewer may see the dashboard at all. There is no identity to
 * carry — one shared account — so this is a three-state flag, not a user.
 */
export type ViewSessionState = "loading" | "anonymous" | "authenticated";

export function useViewSession() {
  const [session, setSession] = React.useState<ViewSessionState>("loading");

  React.useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/view-auth/me", { credentials: "same-origin" });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setSession(data?.authenticated ? "authenticated" : "anonymous");
      } catch {
        // No Worker behind the page (plain `next dev`) or the network is down.
        if (!cancelled) setSession("anonymous");
      }
    }
    check();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = React.useCallback(() => setSession("authenticated"), []);

  const signOut = React.useCallback(async () => {
    try {
      await fetch("/api/view-auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Dropping back to the login screen is still the right thing to show.
    }
    setSession("anonymous");
  }, []);

  return { session, signIn, signOut };
}
