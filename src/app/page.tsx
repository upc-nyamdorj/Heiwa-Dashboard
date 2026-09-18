"use client";

import React, { useEffect, useState } from "react";
import {
  ClipboardCheck,
  UsersRound,
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
import Users from "@/views/Users";
import { useDataset } from "@/lib/DataProvider";
import { date, num } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncButton } from "@/components/SyncButton";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { AuthCheckingScreen } from "@/components/login-shell";
import { AccountLogin } from "@/components/AccountLogin";
import { SignOutButton } from "@/components/SignOutButton";
import { atLeast, useAccount, type Account, type Role } from "@/hooks/use-account";
import { DataProvider } from "@/lib/DataProvider";
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
    icon: LayoutDashboard,
  },
  {
    id: "contracts",
    label: "Гэрээ",
    icon: Handshake,
  },
  {
    id: "payments",
    label: "Санхүүжилт",
    icon: WalletCards,
  },
  {
    id: "documents",
    label: "Баримт бичиг",
    icon: FileText,
  },
  {
    id: "correspondence",
    label: "Захидал / RFI",
    icon: Mail,
  },
  {
    id: "drawings",
    label: "Зургийн бүртгэл",
    icon: DraftingCompass,
  },
  {
    id: "audit",
    label: "Шалгалт",
    icon: ShieldCheck,
  },
  {
    id: "review",
    label: "Баталгаажуулах",
    icon: ClipboardCheck,
    minRole: "admin",
  },
  {
    id: "users",
    label: "Хэрэглэгчид",
    icon: UsersRound,
    minRole: "admin",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Tabs without a stated minimum are open to anyone who is signed in. */
function tabsFor(user: Account) {
  return TABS.filter((t) => atLeast(user, ("minRole" in t ? t.minRole : "viewer") as Role));
}

const ROLE_LABEL: Record<Role, string> = {
  viewer: "Харагч",
  editor: "Синхрончлогч",
  admin: "Админ",
};

/**
 * The gate. Holds no dashboard state and reads no data — everything below it
 * mounts only once a session exists, and DataProvider then fetches the figures
 * over /api/data, which the Worker refuses without that session.
 */
export default function Page() {
  const { session, signIn, signOut } = useAccount();

  if (session.status === "loading") return <AuthCheckingScreen />;
  if (session.status === "anonymous") return <AccountLogin onSignedIn={signIn} />;

  return (
    <DataProvider>
      <Dashboard user={session.user} onSignOut={signOut} />
    </DataProvider>
  );
}

function Dashboard({ user, onSignOut }: { user: Account; onSignOut: () => void }) {
  const { meta, documents, contracts, payments, correspondence, drawings } = useDataset();
  const [tab, setTab] = useState<TabId>("overview");
  const [dark, setDark] = useState(false);

  const visibleTabs = tabsFor(user);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
    const fromHash = window.location.hash.replace("#", "");
    if (tabsFor(user).some((t) => t.id === fromHash)) setTab(fromHash as TabId);
  }, [user]);

  // A role can change under a live session — the Users tab can demote its own
  // owner — so the selected tab is re-checked on every render, not just at
  // mount. Falling back to Тойм is always allowed.
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : "overview";

  const hints: Record<TabId, string> = {
    overview: "Төслийн ерөнхий байдал",
    contracts: `${contracts.length} гэрээ`,
    payments: `${payments.length} тайлан`,
    documents: `${documents.length} файл`,
    correspondence: `${correspondence.length} баримт`,
    drawings: `${drawings.length} багц`,
    audit: "Өгөгдлийн үнэн зөв байдал",
    review: "AI-аар задалсан шинэ баримт — админ",
    users: "Эрх, нууц үг удирдах",
  };

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
                {visibleTabs.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <Button
                        variant={activeTab === item.id ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        title={hints[item.id]}
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
            {atLeast(user, "editor") && <SyncButton />}
            <span
              className="hidden max-w-[22ch] truncate text-xs md:inline"
              style={{ color: "var(--text-muted)" }}
              title={`${user.username} — ${ROLE_LABEL[user.role]}`}
            >
              {user.username} · {ROLE_LABEL[user.role]}
            </span>
            <SignOutButton onSignOut={onSignOut} />
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
          {activeTab === "overview" && <Overview />}
          {activeTab === "contracts" && <Contracts />}
          {activeTab === "payments" && <Payments />}
          {activeTab === "documents" && <Documents />}
          {activeTab === "correspondence" && <CorrespondenceView />}
          {activeTab === "drawings" && <Drawings />}
          {activeTab === "audit" && <Audit />}
          {activeTab === "review" && <Review />}
          {activeTab === "users" && <Users me={user} />}
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
