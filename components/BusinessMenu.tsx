"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronsUpDown, LogOut, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBusiness } from "@/lib/zcashService";

/**
 * The business-profile switcher pinned to the bottom of the sidebar. Click it
 * to reach the profile, settings, or to sign out. (Sign out just returns to the
 * public landing page — this prototype has no real auth session.)
 */
export function BusinessMenu() {
  const router = useRouter();
  const business = getBusiness();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere outside the menu.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initials = business.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="border-b px-3 py-2.5">
            <div className="text-xs font-medium text-foreground">{business.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              Tax PIN {business.taxPin}
            </div>
          </div>
          <div className="p-1">
            <MenuLink href="/profile" icon={<UserRound className="size-4" />} label="Business profile" onClick={() => setOpen(false)} />
            <MenuLink href="/settings" icon={<Settings className="size-4" />} label="Settings" onClick={() => setOpen(false)} />
            <button
              onClick={() => {
                setOpen(false);
                router.push("/");
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
          open ? "border-primary/40 bg-accent" : "hover:bg-accent"
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
          {initials || <Building2 className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">
            {business.name}
          </span>
          <span className="block font-mono text-[11px] text-muted-foreground">
            {business.taxPin}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {icon} {label}
    </Link>
  );
}
