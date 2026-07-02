"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { InvoiceStatusBadge, ReconBadge } from "@/components/StatusBadge";
import { useZcash } from "@/lib/useZcash";
import { listInvoices } from "@/lib/zcashService";
import { formatDate, formatKes, formatZec } from "@/lib/utils";

export default function InvoicesPage() {
  useZcash();
  const router = useRouter();
  const invoices = listInvoices();

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Invoices"
        description="Every invoice is paid in shielded ZEC. Reconciliation matches incoming notes to invoices by memo and amount."
        action={
          <Button asChild>
            <Link href="/invoices/new">
              <FilePlus2 /> New invoice
            </Link>
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reconciliation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow
                key={inv.id}
                className="cursor-pointer"
                onClick={() => router.push(`/invoices/${inv.id}`)}
              >
                <TableCell className="font-mono font-medium">{inv.id}</TableCell>
                <TableCell>{inv.customerName}</TableCell>
                <TableCell className="text-right">
                  <div className="font-medium tabular-nums">
                    {formatZec(inv.amountZec)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {formatKes(inv.amountKes)}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(inv.issueDate)}
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={inv.status} />
                </TableCell>
                <TableCell>
                  <ReconBadge status={inv.reconStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
