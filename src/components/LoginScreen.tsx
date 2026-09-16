"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { MicrosoftSignInButton } from "@/components/MicrosoftSignInButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * /api/auth/callback hands failures back as `/?error=<code>` (see
 * worker/auth.ts). Only the domain rejection gets its own wording — it is the
 * one failure a user can actually do something about. Everything else,
 * cancelled consent and broken handshakes alike, is the same "try again".
 */
const ERROR_MESSAGES: Record<string, string> = {
  wrong_domain: "Зөвхөн @upc.mn имэйлтэй акаунтаар нэвтрэх боломжтой.",
};

const GENERIC_ERROR = "Нэвтрэхэд алдаа гарлаа, дахин оролдоно уу.";

/**
 * Read as the initial state rather than in an effect, so the message is there
 * on the first paint instead of flashing in a frame later. Safe to touch
 * `window` here: the gate only mounts this component after /api/auth/me has
 * resolved on the client, so it never takes part in the prerender.
 */
function errorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("error");
  return code ? (ERROR_MESSAGES[code] ?? GENERIC_ERROR) : null;
}

function BrandMark() {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        H
      </div>
      <span className="text-base font-semibold">Хэйва хотхон</span>
    </div>
  );
}

/** Shared shell so the checking and signed-out states do not jump on resolve. */
function LoginLayout({ children }: { children: React.ReactNode }) {
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
 * Shown while /api/auth/me is in flight. Deliberately not a spinner: the check
 * is one same-origin request, and a spinner that flashes for 80ms reads as a
 * glitch. Reduced-motion users get nothing moving either way.
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

export function LoginScreen() {
  const [error] = useState<string | null>(errorFromUrl);

  useEffect(() => {
    // Drop the parameter once it has been read, so a reload — or a later
    // successful sign-in landing back on `/` — does not resurface a stale
    // failure. replaceState keeps it out of the back-button history too.
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <LoginLayout>
      <Card>
        <CardHeader>
          <CardTitle>Нэвтрэх</CardTitle>
          <CardDescription>
            Самбарын мэдээлэл харахын тулд ажлын акаунтаараа нэвтэрнэ үү.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/25"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <MicrosoftSignInButton />
          <p className="text-xs text-muted-foreground">
            Зөвхөн UPC-ийн ажлын Microsoft акаунтаар (@upc.mn) нэвтэрнэ.
          </p>
        </CardContent>
      </Card>
    </LoginLayout>
  );
}
