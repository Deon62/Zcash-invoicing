"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReconBadge } from "@/components/StatusBadge";
import { useZcash } from "@/lib/useZcash";
import {
  getAuditorLedger,
  getBusiness,
  getPublicLedger,
} from "@/lib/zcashService";
import { cn, formatKes, formatZec, truncateMiddle } from "@/lib/utils";

type View = "public" | "auditor";

/**
 * STEP 1 — "See the privacy".
 * The same shielded transactions shown two ways: opaque to the public, fully
 * readable once a viewing key is applied. This is the explainer, not an action.
 */
export function PrivacyPanel({ onNext }: { onNext: () => void }) {
  useZcash();
  const [view, setView] = useState<View>("public");
  const business = getBusiness();
  const publicLedger = getPublicLedger();
  const auditorLedger = getAuditorLedger();
  const totalKes = auditorLedger.reduce((s, t) => s + t.amountKes, 0);

  const isPublic = view === "public";

  return (
    <div className="space-y-4">
      {/* Control row: toggle on the left, live context on the right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border bg-card p-1 shadow-sm">
          <ToggleButton
            active={isPublic}
            onClick={() => setView("public")}
            icon={<EyeOff className="size-4" />}
            label="Public view"
          />
          <ToggleButton
            active={!isPublic}
            onClick={() => setView("auditor")}
            icon={<Eye className="size-4" />}
            label="Auditor view"
          />
        </div>
        <p className="text-xs text-muted-foreground sm:max-w-xs sm:text-right">
          {isPublic
            ? `${publicLedger.length} shielded txs exist — sender, amount and memo all hidden.`
            : `${business.name}'s viewing key: ${auditorLedger.length} receipts, ${formatKes(totalKes)}.`}
        </p>
      </div>

      {/* Ledger panel */}
      <Card className={cn("overflow-hidden transition-colors", isPublic && "bg-dots")}>
        {/* Explorer chrome */}
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {isPublic ? (
              <Lock className="size-3.5" />
            ) : (
              <KeyRound className="size-3.5 text-success" />
            )}
            {isPublic
              ? "zcash-explorer · orchard pool"
              : `arelis · viewing-key reader · ${business.taxPin}`}
          </div>
          <Badge variant={isPublic ? "muted" : "success"}>
            {isPublic ? "Shielded — opaque" : "Decrypted"}
          </Badge>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[150px_1fr_1fr_140px] gap-3 border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Tx / Block</span>
          <span>{isPublic ? "Sender → Receiver" : "Invoice / Customer"}</span>
          <span>Amount · Memo</span>
          <span className="text-right">{isPublic ? "" : "Reconciliation"}</span>
        </div>

        <div className="divide-y">
          {publicLedger.map((tx, idx) => {
            const a = auditorLedger[idx];
            return (
              <div
                key={tx.txid}
                className="grid grid-cols-[150px_1fr_1fr_140px] items-center gap-3 px-4 py-3"
              >
                {/* Tx / block — visible in both */}
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs font-medium">
                    {truncateMiddle(tx.txid, 8, 6)}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    #{tx.blockHeight.toLocaleString()}
                  </div>
                </div>

                {isPublic ? (
                  <>
                    <Redacted>
                      <span className="font-mono">u1••••••</span>
                      <ArrowRight className="size-3 opacity-40" />
                      <span className="font-mono">u1••••••</span>
                    </Redacted>
                    <Redacted>
                      <span className="font-mono">•••••• ZEC</span>
                      <span className="opacity-50">· encrypted memo</span>
                    </Redacted>
                    <div className="flex justify-end">
                      <Badge variant="muted">
                        <Lock className="size-3" /> Shielded
                      </Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-medium">
                        {a.invoiceId}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.customerName}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium tabular-nums">
                        {formatZec(a.amountZec)}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {formatKes(a.amountKes)}
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        &ldquo;{a.memo}&rdquo;
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <ReconBadge status={a.reconStatus} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* CTA into step 2 */}
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center">
        <ShieldCheck className="size-5 text-primary" />
        <p className="max-w-md text-sm text-muted-foreground">
          Privacy never lifts on its own. When an auditor needs assurance, you
          hand over a key for exactly the right scope.
        </p>
        <Button onClick={onNext}>
          Next: share with an auditor <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Redacted({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
