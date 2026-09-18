"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { LoginLayout } from "@/components/login-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const WRONG_CREDENTIALS = "Хэрэглэгчийн нэр эсвэл нууц үг буруу байна.";
const NOT_CONFIGURED =
  "Нэвтрэлт тохируулагдаагүй байна — админд хандана уу.";
const NETWORK_ERROR =
  "Сүлжээний алдаа гарлаа — холболтоо шалгаад дахин оролдоно уу.";

export function AccountLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !username || !password) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        onSignedIn();
        return;
      }
      setError(res.status === 500 ? NOT_CONFIGURED : WRONG_CREDENTIALS);
    } catch {
      setError(NETWORK_ERROR);
    }
    // Only reached on failure — on success the gate swaps this screen out.
    setBusy(false);
    setPassword("");
  }

  return (
    <LoginLayout>
      <Card>
        <CardHeader>
          <CardTitle>Нэвтрэх</CardTitle>
          <CardDescription>
            Самбарын мэдээлэл харахын тулд ажлын акаунтаараа нэвтэрнэ үү.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/25"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="view-username" className="text-xs font-medium text-muted-foreground">
                Хэрэглэгчийн нэр
              </label>
              <Input
                id="view-username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-11 sm:h-9"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="view-password" className="text-xs font-medium text-muted-foreground">
                Нууц үг
              </label>
              <Input
                id="view-password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="h-11 sm:h-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={busy || !username || !password}
              className="h-11 w-full sm:h-9"
            >
              {busy ? "Нэвтэрч байна…" : "Нэвтрэх"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </LoginLayout>
  );
}
