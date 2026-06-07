"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarRange,
  Check,
  FileCheck2,
  Info,
  KeyRound,
  Loader2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useZcash } from "@/lib/useZcash";
import {
  generatePaymentDisclosurePack,
  generateViewingKeyDisclosure,
  getBusiness,
  listInvoices,
} from "@/lib/zcashService";
import { DisclosureScope, Invoice } from "@/lib/types";
import { cn, formatDate, formatKes, formatZec } from "@/lib/utils";

const RANGE_START = "2026-05-01";
const RANGE_END = "2026-06-03";

/**
 * STEP 2 — "Share with an auditor".
 * The business picks a scope (a date-ranged viewing key, or specific invoices)
 * and generates a disclosure pack. On success we hand the new pack id back so
 * the hub can jump straight to step 3 (the auditor verifying it).
 */
export function SharePanel({
  preselectInvoice,
  onGenerated,
}: {
  preselectInvoice?: string | null;
  onGenerated: (packId: string) => void;
}) {
  useZcash();
  const business = getBusiness();

  const paidInvoices = listInvoices().filter((i) => i.status === "paid");

  const [scope, setScope] = useState<DisclosureScope>(
    preselectInvoice ? "payment" : "viewing_key"
  );
  const [start, setStart] = useState(RANGE_START);
  const [end, setEnd] = useState(RANGE_END);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(preselectInvoice ? [preselectInvoice] : paidInvoices.map((i) => i.id))
  );
  const [generating, setGenerating] = useState(false);

  const included: Invoice[] = useMemo(() => {
    if (scope === "viewing_key") {
      return paidInvoices.filter(
        (i) => i.paidDate && i.paidDate >= start && i.paidDate <= end
      );
    }
    return paidInvoices.filter((i) => selected.has(i.id));
  }, [scope, start, end, selected, paidInvoices]);

  const totalZec = included.reduce((s, i) => s + i.amountZec, 0);
  const totalKes = included.reduce((s, i) => s + i.amountKes, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onGenerate() {
    if (included.length === 0 || generating) return;
    setGenerating(true);
    try {
      const pack =
        scope === "viewing_key"
          ? await generateViewingKeyDisclosure({ start, end })
          : await generatePaymentDisclosurePack(included.map((i) => i.id));
      onGenerated(pack.id);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Choose what to share — a date range or specific invoices, and nothing more.
      </p>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Scope */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1 · Choose scope</CardTitle>
              <CardDescription>Disclosure has two modes. You decide which.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <ScopeCard
                active={scope === "viewing_key"}
                onClick={() => setScope("viewing_key")}
                icon={<KeyRound className="size-4" />}
                title="Full viewing key"
                desc="A date-range key that lets an auditor read every shielded receipt in the period."
              />
              <ScopeCard
                active={scope === "payment"}
                onClick={() => setScope("payment")}
                icon={<FileCheck2 className="size-4" />}
                title="Payment disclosure"
                desc="Per-invoice proofs. Reveals only the specific transactions you pick."
              />
            </CardContent>
          </Card>

          {/* Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                2 · {scope === "viewing_key" ? "Pick a date range" : "Pick invoices"}
              </CardTitle>
              <CardDescription>
                {scope === "viewing_key"
                  ? "The viewing key will be scoped to exactly this window."
                  : "Only the invoices you tick are included in the pack."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scope === "viewing_key" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="start">From</Label>
                    <Input
                      id="start"
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end">To</Label>
                    <Input
                      id="end"
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
                    <CalendarRange className="size-4" />
                    {included.length} reconciled receipts fall in this window.
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {paidInvoices.map((inv) => {
                    const checked = selected.has(inv.id);
                    return (
                      <button
                        key={inv.id}
                        onClick={() => toggle(inv.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          checked
                            ? "border-primary/40 bg-primary/[0.04]"
                            : "hover:bg-accent"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded border",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          )}
                        >
                          {checked && <Check className="size-3.5" />}
                        </span>
                        <span className="flex-1">
                          <span className="font-mono text-sm font-medium">{inv.id}</span>{" "}
                          <span className="text-sm text-muted-foreground">
                            · {inv.customerName}
                          </span>
                        </span>
                        <span className="text-right text-sm font-medium tabular-nums">
                          {formatZec(inv.amountZec)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview: revenue statement */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3 · What the auditor receives</CardTitle>
              <CardDescription>
                A clean revenue statement, plus verification access for every line.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">ZEC</TableHead>
                    <TableHead className="text-right">KES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {included.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.id}</TableCell>
                      <TableCell>{inv.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(inv.paidDate ?? inv.issueDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inv.amountZec.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatKes(inv.amountKes)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {included.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Nothing selected yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Summary rail */}
        <div className="space-y-5">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" /> Disclosure pack
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Row label="Disclosed to" value="Auditor" />
              <Row label="From" value={business.name} />
              <Row label="Tax PIN" value={business.taxPin} mono />
              <Row
                label="Scope"
                value={scope === "viewing_key" ? "Full viewing key" : "Payment disclosure"}
              />
              <Separator />
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Declared revenue
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatKes(totalKes)}
                </div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {formatZec(Number(totalZec.toFixed(8)))} · {included.length} receipts
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-accent/50 px-3 py-2.5 text-xs text-accent-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                You control exactly what is shared. This pack reveals only the
                selected receipts — every other transaction stays shielded.
              </div>

              <Button
                className="w-full"
                disabled={included.length === 0 || generating}
                onClick={onGenerate}
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight />
                )}
                {generating ? "Generating…" : "Generate pack"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ScopeCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors",
        active ? "border-primary/50 bg-primary/[0.04]" : "hover:bg-accent"
      )}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-md",
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </button>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
