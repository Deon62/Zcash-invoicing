"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FilePlus2,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { BusinessMenu } from "@/components/BusinessMenu";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { useZcash } from "@/lib/useZcash";
import { isLoggedIn } from "@/lib/zcashService";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/invoices/new", label: "Create invoice", icon: FilePlus2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  useZcash();
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    } else {
      setMounted(true);
    }
  }, [router]);

  if (!mounted) return null;

  return (
    // h-screen + overflow-hidden pins the shell to the viewport so only the main
    // content scrolls — the sidebar (and the profile in it) stays put.
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — fixed height, never scrolls as a whole */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-border/60 px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>

        {/* Only the nav list scrolls if it ever overflows; profile stays pinned */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-card font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Always-visible business profile */}
        <div className="shrink-0 border-t border-border/60 p-3">
          <BusinessMenu />
        </div>
      </aside>

      {/* Main column — the only scrollable region */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-sidebar px-4 md:hidden">
          <Logo />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-6xl p-5 md:p-8">
            {children}
          </main>

          <footer className="border-t px-5 py-3 text-center text-xs text-muted-foreground">
            {BRAND.name} · {BRAND.promise} · Prototype with mock data — no live
            Zcash integration
          </footer>
        </div>
      </div>
    </div>
  );
}
