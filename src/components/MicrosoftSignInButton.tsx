"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The Microsoft logo, at its published geometry: four squares on a 21×21 grid
 * in the brand's fixed colours. Per Microsoft's branding guidance the mark is
 * never recoloured, so these hex values are literal rather than themed — they
 * are the one part of this screen that does not follow the dashboard palette.
 */
function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="size-5" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/**
 * Microsoft specifies the button surface as well as the mark: white with a
 * #8C8C8C border and #5E5E5E label, or #2F2F2F with a white label on dark
 * backgrounds. Those are kept. Everything the guidance leaves open — height,
 * corner radius, focus ring, the press-down on :active — comes from the
 * dashboard's own Button so it sits with the rest of the UI.
 *
 * "Sign in with Microsoft" stays in English: the guidance treats it as part of
 * the brand signature, not as UI copy to localise.
 *
 * An anchor rather than a button with an onClick: /api/auth/login is a Worker
 * route, not a Next route, so this has to be a real document navigation —
 * which is what a link already is, down to middle-click and "open in new tab".
 */
export function MicrosoftSignInButton() {
  return (
    <a
      href="/api/auth/login"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "h-11 w-full gap-3 border-[#8C8C8C] bg-white px-4 text-[0.9375rem] font-semibold text-[#5E5E5E] hover:bg-[#f3f3f3] hover:text-[#5E5E5E] dark:border-[#8C8C8C] dark:bg-[#2f2f2f] dark:text-white dark:hover:bg-[#3b3b3b]",
      )}
    >
      <MicrosoftLogo />
      Sign in with Microsoft
    </a>
  );
}
