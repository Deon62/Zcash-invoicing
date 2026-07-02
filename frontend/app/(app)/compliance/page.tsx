"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, FileCheck2, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PrivacyPanel } from "@/components/compliance/PrivacyPanel";
import { SharePanel } from "@/components/compliance/SharePanel";
import { VerifyPanel } from "@/components/compliance/VerifyPanel";
import { cn } from "@/lib/utils";

/**
 * The whole privacy → disclosure → verification story on ONE page, as three
 * numbered steps. Each step lives in its own tab; the active tab, the invoice
 * pre-selection, and the open pack are all carried in the URL so links and the
 * browser back button keep working.
 */

type TabKey = "privacy" | "share" | "verify";

const STEPS: {
  key: TabKey;
  n: number;
  title: string;
  who: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "privacy", n: 1, title: "See the privacy", who: "What anyone sees vs. what a key unlocks", icon: Eye },
  { key: "share", n: 2, title: "Share with auditor", who: "You generate a scoped disclosure pack", icon: FileCheck2 },
  { key: "verify", n: 3, title: "Auditor verifies", who: "They check every receipt on-chain", icon: ScanLine },
];

export default function CompliancePage() {
  return (
    <Suspense fallback={null}>
      <ComplianceInner />
    </Suspense>
  );
}

function ComplianceInner() {
  const router = useRouter();
  const params = useSearchParams();

  const tab = (params.get("tab") as TabKey) || "privacy";
  const invoice = params.get("invoice");
  const pack = params.get("pack");

  // Rewrite the query string while preserving the other keys we care about.
  const navigate = useCallback(
    (next: { tab?: TabKey; invoice?: string | null; pack?: string | null }) => {
      const sp = new URLSearchParams(params.toString());
      const apply = (key: string, value: string | null | undefined) => {
        if (value === undefined) return; // leave untouched
        if (value === null) sp.delete(key);
        else sp.set(key, value);
      };
      apply("tab", next.tab);
      apply("invoice", next.invoice);
      apply("pack", next.pack);
      router.replace(`/compliance?${sp.toString()}`, { scroll: false });
    },
    [params, router]
  );

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Compliance"
        description="One flow, three steps — walk left to right."
      />

      {/* Step indicator / tabs */}
      <div className="grid gap-2 sm:grid-cols-3">
        {STEPS.map((step) => {
          const active = tab === step.key;
          const Icon = step.icon;
          return (
            <button
              key={step.key}
              onClick={() => navigate({ tab: step.key })}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/[0.05] ring-1 ring-primary/20"
                  : "hover:bg-accent"
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {step.n}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon className="size-3.5" /> {step.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {step.who}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Active step */}
      {tab === "privacy" && <PrivacyPanel onNext={() => navigate({ tab: "share" })} />}

      {tab === "share" && (
        <SharePanel
          preselectInvoice={invoice}
          onGenerated={(packId) => navigate({ tab: "verify", pack: packId, invoice: null })}
        />
      )}

      {tab === "verify" && (
        <VerifyPanel
          selectedPackId={pack}
          onSelectPack={(id) => navigate({ pack: id })}
          onShare={() => navigate({ tab: "share" })}
        />
      )}
    </div>
  );
}
