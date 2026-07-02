"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/CopyButton";
import { InvoiceStatusBadge, ReconBadge } from "@/components/StatusBadge";
import { useZcash } from "@/lib/useZcash";
import {
  MEMO_MAX_BYTES,
  getInvoice,
  getPaymentRequest,
  memoByteLength,
  simulatePaymentReceived,
} from "@/lib/zcashService";
import { formatDate, formatKes, formatZec, truncateMiddle } from "@/lib/utils";

export default function InvoiceDetailPage() {
  useZcash();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const invoice = getInvoice(params.id);
  const [simulating, setSimulating] = useState(false);

  async function handleSimulate() {
    if (!invoice || simulating) return;
    setSimulating(true);
    try {
      await simulatePaymentReceived(invoice.id);
    } finally {
      setSimulating(false);
    }
  }

  if (!invoice) {
    return (
      <div className="animate-fade-in space-y-4">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="outline" onClick={() => router.push("/invoices")}>
          <ArrowLeft /> Back to invoices
        </Button>
      </div>
    );
  }

  const pr = getPaymentRequest(invoice.id);
  const memoBytes = memoByteLength(pr.memo);
  const isPaid = invoice.status === "paid";

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 text-muted-foreground"
          onClick={() => router.push("/invoices")}
        >
          <ArrowLeft /> Invoices
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {invoice.id}
          </h1>
          <InvoiceStatusBadge status={invoice.status} />
          <ReconBadge status={invoice.reconStatus} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {invoice.customerName} · Issued {formatDate(invoice.issueDate)} · Due{" "}
          {formatDate(invoice.dueDate)}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Payment request */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4 text-primary" /> Shielded payment request
            </CardTitle>
            <CardDescription>
              The customer scans this with any Zcash wallet to pay in shielded
              ZEC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <QRCodeSVG
                  value={pr.paymentUri}
                  size={184}
                  level="M"
                  marginSize={0}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <Field label="Amount">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold tabular-nums">
                    {formatZec(pr.amountZec)}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    ≈ {formatKes(invoice.amountKes)}
                  </span>
                </div>
              </Field>

              <Field label="Pay to — unified address (shielded receiver)">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2.5 py-1.5 font-mono text-xs">
                    {truncateMiddle(pr.unifiedAddress, 16, 10)}
                  </code>
                  <CopyButton value={pr.unifiedAddress} label="Copy" />
                </div>
              </Field>

              <Field
                label={
                  <span className="flex items-center justify-between">
                    <span>Encrypted memo — carries the invoice reference</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {memoBytes}/{MEMO_MAX_BYTES} bytes
                    </span>
                  </span>
                }
              >
                <div className="rounded-md border bg-accent/40 px-3 py-2 text-sm">
                  &ldquo;{pr.memo}&rdquo;
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  This memo is encrypted to the recipient inside the shielded
                  note — invisible on the public chain, but it lets the payment
                  auto-reconcile to this invoice.
                </p>
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Invoice + actions */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.lineItems.map((li, i) => (
                <div key={i} className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{li.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {li.quantity} × {formatZec(li.unitPriceZec)}
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium tabular-nums">
                    {formatZec(li.quantity * li.unitPriceZec)}
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">
                    {formatZec(invoice.amountZec)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {formatKes(invoice.amountKes)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isPaid ? (
            <Card className="border-success/30 bg-success/[0.04]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-success">
                  <CheckCircle2 className="size-4" /> Payment received &
                  reconciled
                </CardTitle>
                <CardDescription>
                  The shielded note arrived, its memo matched {invoice.id}, and
                  the amount matched — so Arelis reconciled it automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Shielded transaction id">
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2.5 py-1.5 font-mono text-xs">
                      {invoice.txid}
                    </code>
                    <CopyButton value={invoice.txid ?? ""} label="Copy" />
                  </div>
                </Field>
                <Field label="Paid">
                  <span className="text-sm">
                    {invoice.paidDate ? formatDate(invoice.paidDate) : "—"}
                  </span>
                </Field>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/compliance?tab=privacy">
                      <ShieldCheck /> See it in the reveal
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/compliance?tab=share&invoice=${invoice.id}`}>
                      Disclose this payment
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : invoice.status === "awaiting_payment" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="size-4 text-muted-foreground" /> Awaiting
                  payment
                </CardTitle>
                <CardDescription>
                  Prototype shortcut: simulate the customer paying to watch the
                  invoice move to paid and auto-reconcile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant="success"
                  disabled={simulating}
                  onClick={handleSimulate}
                >
                  {simulating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Zap />
                  )}{" "}
                  {simulating ? "Processing…" : "Simulate payment received"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Draft</CardTitle>
                <CardDescription>
                  This invoice is a draft. In the full product you would finalise
                  it to begin awaiting payment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant="success"
                  disabled={simulating}
                  onClick={handleSimulate}
                >
                  {simulating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Zap />
                  )}{" "}
                  {simulating ? "Processing…" : "Simulate payment received"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
