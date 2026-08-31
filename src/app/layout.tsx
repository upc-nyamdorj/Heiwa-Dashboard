import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Golos_Text } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * One family for everything — headings, body, and financial figures alike,
 * differentiated only by weight/size. Cyrillic-native (not a Latin face with
 * Cyrillic bolted on), which reads with more character than the previous
 * system-ui stack. Self-hosted at build time via next/font, so this works
 * under `output: 'export'` with no runtime Google Fonts request.
 */
const golosText = Golos_Text({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Хэйва хотхон — Төслийн хяналтын самбар",
  description:
    "UPH Heiwa Project: баримт бичиг, гэрээ, санхүүжилт, захидал харилцаа, зургийн бүртгэлийн нэгдсэн хяналт.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

/**
 * Stamp the theme before first paint so a dark-mode viewer never sees a light
 * flash. The toggle writes localStorage; the OS setting is the fallback.
 */
const THEME_BOOT = `
(function () {
  try {
    var saved = localStorage.getItem('heiwa-theme');
    var dark = saved ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="mn"
      suppressHydrationWarning
      className={cn("font-sans", golosText.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
