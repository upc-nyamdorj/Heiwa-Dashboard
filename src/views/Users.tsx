"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/chart-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/DataTable";
import { date } from "@/lib/format";
import type { Account, Role } from "@/hooks/use-account";

const ROLE_LABEL: Record<Role, string> = {
  viewer: "Харагч",
  editor: "Синхрончлогч",
  admin: "Админ",
};

const ROLE_HINT: Record<Role, string> = {
  viewer: "Зөвхөн самбар харна",
  editor: "Самбар + Sync эхлүүлнэ",
  admin: "Бүх эрх + хэрэглэгч удирдана",
};

const ROLE_OPTIONS = (Object.keys(ROLE_LABEL) as Role[]).map((value) => ({
  value,
  label: ROLE_LABEL[value],
}));

const MIN_PASSWORD = 10;

/** Server-side refusals that a person can act on; anything else is generic. */
const ERRORS: Record<string, string> = {
  username_taken: "Энэ нэр аль хэдийн бүртгэлтэй байна.",
  password_too_short: `Нууц үг дор хаяж ${MIN_PASSWORD} тэмдэгт байх ёстой.`,
  cannot_demote_self: "Өөрийн эрхээ бууруулж болохгүй.",
  cannot_delete_self: "Өөрийгөө устгаж болохгүй.",
  last_admin: "Сүүлийн админыг устгах/бууруулах боломжгүй.",
  wrong_password: "Одоогийн нууц үг буруу байна.",
  invalid_body: "Талбаруудыг бүрэн бөглөнө үү.",
  forbidden: "Танд энэ эрх алга.",
};

async function call(path: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: ERRORS[data?.error] ?? "Үйлдэл амжилтгүй боллоо." };
  } catch {
    return { ok: false, error: "Сүлжээний алдаа гарлаа." };
  }
}

export default function Users({ me }: { me: Account }) {
  const [users, setUsers] = useState<Account[] & { createdAt?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Returns the outcome rather than setting state itself, so the effect below
  // only ever assigns in a callback — the shape the react-hooks rules want.
  const fetchUsers = useCallback(async (): Promise<{ users?: Account[]; error?: string }> => {
    try {
      const res = await fetch("/api/users", { credentials: "same-origin" });
      if (!res.ok) return { error: "Жагсаалт татахад алдаа гарлаа." };
      return { users: (await res.json()).users };
    } catch {
      return { error: "Сүлжээний алдаа гарлаа." };
    }
  }, []);

  const apply = useCallback((result: { users?: Account[]; error?: string }) => {
    if (result.users) setUsers(result.users);
    setError(result.error ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchUsers().then((result) => { if (!cancelled) apply(result); });
    return () => { cancelled = true; };
  }, [fetchUsers, apply]);

  async function run(path: string, body: unknown) {
    setBusy(true);
    const result = await call(path, body);
    if (result.ok) apply(await fetchUsers());
    else setError(result.error ?? null);
    setBusy(false);
    return result.ok;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm"
          style={{ background: "color-mix(in oklch, var(--status-critical), transparent 90%)", color: "var(--status-critical)" }}>
          {error}
        </p>
      )}

      <NewUser busy={busy} onCreate={(body) => run("/api/users", body)} />

      <Card title="Хэрэглэгчид" subtitle="Эрх өөрчлөх, нууц үг шинэчлэх, устгах">
        {users === null ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Ачааллаж байна…</p>
        ) : (
          <div className="overflow-x-auto scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th>Нэр</th>
                  <th>Эрх</th>
                  <th>Үүсгэсэн</th>
                  <th><span className="sr-only">Үйлдэл</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow key={u.id} user={u} isMe={u.id === me.id} busy={busy} run={run} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <OwnPassword busy={busy} onChange={(body) => run("/api/session/password", body)} />
    </div>
  );
}

function UserRow({
  user, isMe, busy, run,
}: {
  user: Account & { createdAt?: string };
  isMe: boolean;
  busy: boolean;
  run: (path: string, body: unknown) => Promise<boolean>;
}) {
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  return (
    <tr>
      <td className="strong">
        {user.username}
        {isMe && <span className="ml-1 text-xs" style={{ color: "var(--text-muted)" }}>(та)</span>}
      </td>
      <td>
        <Select
          value={user.role}
          options={ROLE_OPTIONS}
          onChange={(role) => run("/api/users/role", { id: user.id, role })}
          label=""
        />
        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{ROLE_HINT[user.role]}</span>
      </td>
      <td>{user.createdAt ? date(user.createdAt.slice(0, 10)) : "—"}</td>
      <td>
        <div className="flex flex-wrap items-center gap-1.5">
          {resetting ? (
            <>
              <Input
                type="password"
                className="h-8 w-40"
                placeholder={`Шинэ нууц үг (${MIN_PASSWORD}+)`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy || newPassword.length < MIN_PASSWORD}
                onClick={async () => {
                  if (await run("/api/users/password", { id: user.id, newPassword })) {
                    setResetting(false);
                    setNewPassword("");
                  }
                }}
              >
                Хадгалах
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setResetting(false); setNewPassword(""); }}>
                Болих
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setResetting(true)}>
                Нууц үг солих
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy || isMe}
                title={isMe ? "Өөрийгөө устгах боломжгүй" : "Хэрэглэгчийг устгах"}
                onClick={() => {
                  if (window.confirm(`"${user.username}"-ийг устгах уу?`)) {
                    run("/api/users/delete", { id: user.id });
                  }
                }}
              >
                Устгах
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function NewUser({
  busy, onCreate,
}: {
  busy: boolean;
  onCreate: (body: { username: string; password: string; role: Role }) => Promise<boolean>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("viewer");

  const ready = username.trim().length > 0 && password.length >= MIN_PASSWORD;

  return (
    <Card title="Шинэ хэрэглэгч" subtitle="Түр нууц үг өгөөд, эзэмшигч нь өөрөө солино">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready || busy) return;
          if (await onCreate({ username: username.trim(), password, role })) {
            setUsername(""); setPassword(""); setRole("viewer");
          }
        }}
      >
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Хэрэглэгчийн нэр
          <Input className="h-9 w-44" value={username} autoComplete="off"
            onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Түр нууц үг ({MIN_PASSWORD}+ тэмдэгт)
          <Input className="h-9 w-52" type="password" value={password} autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)} />
        </label>
        <Select value={role} options={ROLE_OPTIONS} onChange={(v) => setRole(v as Role)} label="Эрх" />
        <Button type="submit" className="h-9" disabled={!ready || busy}>Нэмэх</Button>
      </form>
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{ROLE_HINT[role]}</p>
    </Card>
  );
}

function OwnPassword({
  busy, onChange,
}: {
  busy: boolean;
  onChange: (body: { currentPassword: string; newPassword: string }) => Promise<boolean>;
}) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [done, setDone] = useState(false);

  const ready = currentPassword.length > 0 && newPassword.length >= MIN_PASSWORD;

  return (
    <Card title="Өөрийн нууц үг" subtitle="Одоогийн нууц үгээ баталгаажуулна">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready || busy) return;
          const ok = await onChange({ currentPassword, newPassword });
          setDone(ok);
          if (ok) { setCurrent(""); setNew(""); }
        }}
      >
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Одоогийн нууц үг
          <Input className="h-9 w-52" type="password" autoComplete="current-password"
            value={currentPassword} onChange={(e) => { setCurrent(e.target.value); setDone(false); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Шинэ нууц үг ({MIN_PASSWORD}+ тэмдэгт)
          <Input className="h-9 w-52" type="password" autoComplete="new-password"
            value={newPassword} onChange={(e) => { setNew(e.target.value); setDone(false); }} />
        </label>
        <Button type="submit" className="h-9" disabled={!ready || busy}>Солих</Button>
        {done && <span className="text-xs" style={{ color: "var(--success-text)" }}>Солигдлоо</span>}
      </form>
    </Card>
  );
}
