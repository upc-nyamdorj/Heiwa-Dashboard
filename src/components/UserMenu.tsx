"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/hooks/use-session";

/**
 * Header identity strip. The name is dropped below md — the header is 48px of
 * a very crowded row on a phone — but the address stays reachable through the
 * button's own tooltip, so the signed-in account is never a mystery.
 */
export function UserMenu({
  user,
  onSignOut,
}: {
  user: SessionUser;
  onSignOut: () => void;
}) {
  return (
    <>
      <span
        className="hidden max-w-[20ch] truncate text-xs text-muted-foreground md:inline"
        title={user.email}
      >
        {user.name}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onSignOut}
        title={`${user.email} — гарах`}
        aria-label="Гарах"
        className="h-11 px-3 sm:h-7 sm:px-2.5"
      >
        <LogOut />
        <span className="hidden sm:inline">Гарах</span>
      </Button>
    </>
  );
}
