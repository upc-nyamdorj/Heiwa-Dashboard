"use client";

import React, { useEffect, useState } from "react";
import {
  ClipboardCheck,
  DraftingCompass,
  FileText,
  Handshake,
  LayoutDashboard,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  WalletCards,
} from "lucide-react";
import Overview from "@/views/Overview";
import Documents from "@/views/Documents";
import Contracts from "@/views/Contracts";
import Payments from "@/views/Payments";
import CorrespondenceView from "@/views/Correspondence";
import Drawings from "@/views/Drawings";
import Audit from "@/views/Audit";
import Review from "@/views/Review";
import {
  meta,
  documents,
  contracts,
  payments,
  correspondence,
  drawings,
} from "@/lib/data";
import { date, num } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncButton } from "@/components/SyncButton";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const TABS = [
  {
    id: "overview",
    label: "Тойм",
    hint: "Төслийн ерөнхий байдал",
    icon: LayoutDashboard,
  },
  {
    id: "contracts",
    label: "Гэрээ",
    hint: `${contracts.length} гэрээ`,
    icon: Handshake,
  },
  {
    id: "payments",
    label: "Санхүүжилт",
    hint: `${payments.length} тайлан`,
    icon: WalletCards,
  },
  {
    id: "documents",
    label: "Баримт бичиг",
    hint: `${documents.length} файл`,
    icon: FileText,
  },
  {
    id: "correspondence",
    label: "Захидал / RFI",
    hint: `${correspondence.length} баримт`,
    icon: Mail,
  },
  {
    id: "drawings",
    label: "Зургийн бүртгэл",
    hint: `${drawings.length} багц`,
    icon: DraftingCompass,
  },
  {
    id: "audit",
    label: "Шалгалт",
    hint: "Өгөгдлийн үнэн зөв байдал",
    icon: ShieldCheck,
  },
  {
    id: "review",
    label: "Баталгаажуулах",
    hint: "AI-аар задалсан шинэ баримт — админ",
    icon: ClipboardCheck,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Page() {
  const [tab, setTab] = useState<TabId>("overview");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
    const fromHash = window.location.hash.replace("#", "");
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash as TabId);
  }, []);

  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("heiwa-theme", next);
    } catch {
      /* private mode */
    }
    setDark(!dark);
  };

  const go = (id: TabId) => {
    setTab(id);
    if (typeof window !== "undefined") window.location.hash = id;
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              H
            </div>
            <span className="truncate text-sm font-semibold">Хэйва хотхон</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Төслийн хяналт</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {TABS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <Button
                        variant={tab === item.id ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        title={item.hint}
                        onClick={() => go(item.id)}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </Button>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
            <p className="text-xs font-medium">{meta.client}</p>
            <p className="mt-0.5 text-xs text-sidebar-foreground/60">
              {meta.manager}
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger className="no-print" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">
              Хэйва хотхон — төслийн хяналтын самбар
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {date(meta.dateMin)} – {date(meta.dateMax)}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <SyncStatusBadge />
            <Badge variant="secondary" className="hidden tnum sm:inline-flex">
              {num(meta.fileCount)} баримт
            </Badge>
            <SyncButton />
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              title={dark ? "Цайвар горим" : "Бараан горим"}
              aria-label="Өнгөний горим солих"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>

        <main className="dashboard-content mx-auto w-full max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
          {tab === "overview" && <Overview />}
          {tab === "contracts" && <Contracts />}
          {tab === "payments" && <Payments />}
          {tab === "documents" && <Documents />}
          {tab === "correspondence" && <CorrespondenceView />}
          {tab === "drawings" && <Drawings />}
          {tab === "audit" && <Audit />}
          {tab === "review" && <Review />}
        </main>

        <footer className="mx-auto w-full max-w-[1500px] px-3 pb-6 text-xs text-muted-foreground sm:px-4">
          <p>
            Эх сурвалж: «{meta.sourceFolder}» хавтас — {num(meta.fileCount)}{" "}
            файл. Гэрээ, санхүүжилтийн дүнг сканнердсан PDF-ийн хураангуй
            хуудаснаас уншиж авсан ({meta.extractedDocs} баримт). Дүн
            уншигдаагүй {meta.extractFailed.length}
            баримтыг тооцоонд оруулаагүй.
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
