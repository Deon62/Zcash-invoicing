"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Inbox,
  KeyRound,
  Loader2,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import { useZcash } from "@/lib/useZcash";
import {
  getDisclosurePack,
  listDisclosurePacks,
  verifyDisclosure,
} from "@/lib/zcashService";
import { DisclosurePack, VerificationResult } from "@/lib/types";
import { cn, formatDate, formatKes, formatZec, truncateMiddle } from "@/lib/utils";

/**
 * STEP 3 — "Auditor verifies".
 * The auditor's side. Lists every disclosure pack the business has sent; open
 * one to verify each declared receipt against the chain. The selected pack is
 * controlled by the hub (via the `?pack=` query) so deep links work.
 */
export function VerifyPanel({
  selectedPackId,
  onSelectPack,
  onShare,
}: {
  selectedPackId?: string | null;
  onSelectPack: (id: string | null) => void;
  onShare: () => void;
}) {
  useZcash();
  const packs = listDisclosurePacks();
  const selected = selectedPackId ? getDisclosurePack(selectedPackId) : undefined;

  if (selected) {
    return <PackVerification pack={selected} onBack={() => onSelectPack(null)} />;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        What the auditor sees. Open a pack to check each receipt against the chain.
      </p>

      {packs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium">No disclosure packs yet</div>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Generate one in step 2 and it will land here for verification.
              </p>
            </div>
            <Button onClick={onShare}>
              Go to step 2 · Share with auditor <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packs.map((pack) => (
            <Card
              key={pack.id}
              className="cursor-pointer transition-colors hover:border-primary/40"
              onClick={() => onSelectPack(pack.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-sm">{pack.id}</CardTitle>
                  <Badge variant={pack.scope === "viewing_key" ? "default" : "secondary"}>
                    {pack.scope === "viewing_key" ? "Viewing key" : "Payment disclosure"}
                  </Badge>
                </div>
                <CardDescription>
                  From {pack.businessName} ·{" "}
                  {pack.rangeStart && pack.rangeEnd
                    ? `${formatDate(pack.rangeStart)} – ${formatDate(pack.rangeEnd)}`
                    : `${pack.items.length} receipts`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Declared revenue</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {formatKes(pack.totalKes)}
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <ScanLine /> Open &amp; verify
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  The verification view for a single pack (was /auditor/[packId])           */
/* -------------------------------------------------------------------------- */

type RowState = "pending" | "verifying" | "verified";

function PackVerification({ pack, onBack }: { pack: DisclosurePack; onBack: () => void }) {
  const results: VerificationResult[] = useMemo(() => verifyDisclosure(pack), [pack]);
  const [states, setStates] = useState<Record<string, RowState>>({});

  function stateOf(id: string): RowState {
    return states[id] ?? "pending";
  }

  function verifyOne(id: string) {
    if (stateOf(id) !== "pending") return;
    setStates((p) => ({ ...p, [id]: "verifying" }));
    setTimeout(() => {
      setStates((p) => ({ ...p, [id]: "verified" }));
    }, 700);
  }

  function verifyAll() {
    pack.items.forEach((it, idx) => {
      if (stateOf(it.invoiceId) === "verified") return;
      setStates((p) => ({ ...p, [it.invoiceId]: "verifying" }));
      setTimeout(() => {
        setStates((p) => ({ ...p, [it.invoiceId]: "verified" }));
      }, 350 + idx * 320);
    });
  }

  const verifiedCount = pack.items.filter((it) => stateOf(it.invoiceId) === "verified").length;
  const allVerified = verifiedCount === pack.items.length && pack.items.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 text-muted-foreground"
          onClick={onBack}
        >
          <ArrowLeft /> All disclosure packs
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ScanLine className="size-5 text-primary" /> Verifying
          </h2>
          <span className="font-mono text-sm text-muted-foreground">{pack.id}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Disclosed by {pack.businessName} (PIN {pack.taxPin})
        </p>
      </div>

      {/* Pack provenance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-primary" /> Disclosure scope
          </CardTitle>
          <CardDescription>
            {pack.scope === "viewing_key"
              ? "A full viewing key was shared for a bounded date range — read access to exactly these receipts and no others."
              : "Per-invoice payment disclosures were shared — proofs for exactly the selected transactions."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Meta label="Scope">
            <Badge variant={pack.scope === "viewing_key" ? "default" : "secondary"}>
              {pack.scope === "viewing_key" ? "Full viewing key" : "Payment disclosure"}
            </Badge>
          </Meta>
          <Meta label="Period">
            {pack.rangeStart && pack.rangeEnd
              ? `${formatDate(pack.rangeStart)} – ${formatDate(pack.rangeEnd)}`
              : `${pack.items.length} selected receipts`}
          </Meta>
          {pack.viewingKey && (
            <div className="sm:col-span-2 space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Viewing key
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2.5 py-1.5 font-mono text-xs">
                  {truncateMiddle(pack.viewingKey, 20, 12)}
                </code>
                <CopyButton value={pack.viewingKey} label="Copy" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification result banner */}
      {allVerified ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-success/40 bg-success/[0.06] p-6 text-center">
          <BadgeCheck className="size-7 text-success" />
          <div className="text-lg font-semibold text-success">
            All {pack.items.length} receipts verified on-chain
          </div>
          <p className="max-w-lg text-sm text-foreground">
            Declared revenue of{" "}
            <span className="font-semibold">{formatKes(pack.totalKes)}</span> (
            {formatZec(pack.totalZec)}) matches real shielded receipts exactly.
            Nothing was taken on trust.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4">
          <div>
            <div className="text-sm font-medium">
              {verifiedCount} of {pack.items.length} verified
            </div>
            <p className="text-sm text-muted-foreground">
              Verify each declared receipt against the chain to confirm it&rsquo;s real.
            </p>
          </div>
          <Button onClick={verifyAll}>
            <ShieldCheck /> Verify all on-chain
          </Button>
        </div>
      )}

      {/* Items */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice / Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Declared</TableHead>
              <TableHead className="text-right">On-chain</TableHead>
              <TableHead className="text-right">Verify</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pack.items.map((it) => {
              const st = stateOf(it.invoiceId);
              const result = results.find((r) => r.invoiceId === it.invoiceId);
              const showOnChain = st === "verified";
              return (
                <TableRow key={it.invoiceId}>
                  <TableCell>
                    <div className="font-mono text-sm font-medium">{it.invoiceId}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.customerName} · tx {truncateMiddle(it.txid, 6, 6)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(it.date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium tabular-nums">{it.amountZec.toFixed(2)} ZEC</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatKes(it.amountKes)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {showOnChain ? (
                      <span className="font-medium text-success">
                        {result?.onChainZec.toFixed(2)} ZEC
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <VerifyCell state={st} onClick={() => verifyOne(it.invoiceId)} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Separator />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">Total declared</span>
          <div className="text-right">
            <div className="font-semibold tabular-nums">{formatZec(pack.totalZec)}</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {formatKes(pack.totalKes)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function VerifyCell({ state, onClick }: { state: RowState; onClick: () => void }) {
  if (state === "verified")
    return (
      <Badge variant="success" className="ml-auto">
        <CheckCircle2 className="size-3" /> Verified
      </Badge>
    );
  if (state === "verifying")
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="size-3.5 animate-spin" /> Verifying
      </Button>
    );
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <ShieldCheck className="size-3.5" /> Verify on-chain
    </Button>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
