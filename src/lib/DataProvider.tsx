"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { buildDataset, type DashboardData } from "@/lib/data";

/**
 * Fetches the dataset from the Worker and hands it to the tree below.
 *
 * Views used to import their figures straight from src/lib/data.ts, which
 * imported heiwa.json — and under `output: 'export'` that baked every number
 * into a public JS chunk, readable without signing in. The data now arrives
 * over GET /api/data, which requires a session, and this provider is the one
 * place that asks for it. Nothing underneath renders until it has arrived, so
 * no view needs its own loading branch.
 */

const DataContext = createContext<DashboardData | null>(null);

export function useDataset(): DashboardData {
  const value = useContext(DataContext);
  if (!value) {
    throw new Error("useDataset must be used inside <DataProvider>");
  }
  return value;
}

type State =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "error"; message: string };

const UNAUTHORIZED = "Нэвтрэлт дууссан байна — хуудсыг дахин ачаалж нэвтэрнэ үү.";
const UNREACHABLE = "Өгөгдөл татахад алдаа гарлаа — дахин оролдоно уу.";

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <p className="text-center text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/data", { credentials: "same-origin" });
        if (!res.ok) {
          if (!cancelled) {
            setState({ status: "error", message: res.status === 401 ? UNAUTHORIZED : UNREACHABLE });
          }
          return;
        }
        // buildDataset validates and can throw on a schema mismatch; that is a
        // real failure worth surfacing, not a blank dashboard.
        const data = buildDataset(await res.json());
        if (!cancelled) setState({ status: "ready", data });
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", message: err instanceof Error ? err.message : UNREACHABLE });
        }
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <Centred>Өгөгдөл ачаалж байна…</Centred>;
  if (state.status === "error") return <Centred>{state.message}</Centred>;

  return <DataContext.Provider value={state.data}>{children}</DataContext.Provider>;
}
