import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Хэйва хотхон — Төслийн хяналтын самбар',
  description:
    'UPH Heiwa Project: баримт бичиг, гэрээ, санхүүжилт, захидал харилцаа, зургийн бүртгэлийн нэгдсэн хяналт.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
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
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
