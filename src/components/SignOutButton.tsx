"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Header logout. Full 44px target on a phone, the header's compact 28px from
 * sm: up, with the label dropped on the narrow end where the row is tightest.
 */
export function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onSignOut}
      title="Гарах"
      aria-label="Гарах"
      className="h-11 px-3 sm:h-7 sm:px-2.5"
    >
      <LogOut />
      <span className="hidden sm:inline">Гарах</span>
    </Button>
  );
}
