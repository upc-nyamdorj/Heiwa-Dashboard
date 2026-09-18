"use client";

import React from "react";

/**
 * The frame both sign-in screens sit in — the dashboard's own tokens, nothing
 * bespoke. Shared so the parked Microsoft screen and the live view login stay
 * visually identical; only the credential control between them differs.
 */

export function BrandMark() {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        H
      </div>
      <span className="text-base font-semibold">Heiwa Төслийн Dashboard</span>
    </div>
  );
}

export function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <BrandMark />
      <div className="w-full max-w-sm">{children}</div>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        UPH Heiwa Project — төслийн хяналтын самбар
      </p>
    </div>
  );
}

/**
 * Shown while the session check is in flight. Deliberately not a spinner: the
 * check is one same-origin request, and a spinner that flashes for 80ms reads
 * as a glitch.
 */
export function AuthCheckingScreen() {
  return (
    <LoginLayout>
      <p className="text-center text-sm text-muted-foreground">
        Нэвтрэлт шалгаж байна…
      </p>
    </LoginLayout>
  );
}
