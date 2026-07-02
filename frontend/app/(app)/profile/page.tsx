"use client";

import { Building2, Hash, ShieldCheck, Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import { PageHeader } from "@/components/PageHeader";
import { useZcash } from "@/lib/useZcash";
import { getBusiness, getAccountBalanceShielded, listInvoices } from "@/lib/zcashService";
import { formatKes, formatZec, truncateMiddle } from "@/lib/utils";

export default function ProfilePage() {
  useZcash();
  const business = getBusiness();
  const balance = getAccountBalanceShielded();
  const invoices = listInvoices();
  const paid = invoices.filter((i) => i.status === "paid").length;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Business profile"
        description="The identity that appears on every invoice and disclosure pack you send."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary" /> {business.name}
          </CardTitle>
          <CardDescription>Registered business · Zcash shielded account</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field icon={<Hash className="size-4" />} label="Tax PIN" value={business.taxPin} mono />
          <Field
            icon={<ShieldCheck className="size-4" />}
            label="Reconciled receipts"
            value={`${paid} of ${invoices.length} invoices`}
          />
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Wallet className="size-4" /> Unified address (shielded receiver)
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2.5 py-2 font-mono text-xs">
                {business.unifiedAddress}
              </code>
              <CopyButton value={business.unifiedAddress} label="Copy" />
            </div>
            <p className="text-xs text-muted-foreground">
              Customers pay invoices into diversified receivers derived from this
              account. The public chain never links them back to {business.name}.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Shielded balance</CardTitle>
          <CardDescription>Spendable value held privately in this account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold tabular-nums">{formatZec(balance.zec)}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            ≈ {formatKes(balance.kesEquivalent)}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        This is a prototype — profile fields are seeded demo data and read-only.
        In production these would be editable and backed by your wallet account.
      </p>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className={mono ? "font-mono text-sm" : "text-sm font-medium"}>{value}</div>
    </div>
  );
}
