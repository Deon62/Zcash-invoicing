"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/PageHeader";
import { useZcash } from "@/lib/useZcash";
import {
  ZEC_TO_KES,
  createInvoice,
  listCustomers,
  listInvoices,
  zecToKes,
} from "@/lib/zcashService";
import { LineItem } from "@/lib/types";
import { formatKes, formatZec } from "@/lib/utils";

const DEFAULT_DUE = "2026-06-30";

export default function NewInvoicePage() {
  useZcash();
  const router = useRouter();
  const customers = listCustomers();

  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(DEFAULT_DUE);
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPriceZec: 1 },
  ]);

  // Auto invoice ID preview — the next sequential id the service will assign.
  const nextId = useMemo(() => {
    const seq = listInvoices().length + 1;
    return `INV-2026-${String(seq).padStart(4, "0")}`;
  }, []);

  const totalZec = items.reduce(
    (s, li) => s + (li.quantity || 0) * (li.unitPriceZec || 0),
    0
  );
  const totalKes = zecToKes(totalZec);

  const canSave =
    customerId &&
    items.length > 0 &&
    items.every((li) => li.description.trim() && li.quantity > 0 && li.unitPriceZec > 0);

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((li, i) => (i === idx ? { ...li, ...patch } : li))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPriceZec: 1 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function onSave() {
    if (!canSave) return;
    const invoice = createInvoice({ customerId, lineItems: items, dueDate });
    router.push(`/invoices/${invoice.id}`);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Create invoice"
        description="On save, Arelis generates a shielded payment request — a unified address, an encrypted memo carrying the invoice reference, and a QR code."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer">Customer</Label>
                <Select
                  id="customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due">Due date</Label>
                <Input
                  id="due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice ID</Label>
                <div className="flex h-10 items-center rounded-md border border-dashed bg-secondary px-3 font-mono text-sm text-muted-foreground">
                  {nextId}{" "}
                  <span className="ml-2 text-xs">· auto-assigned</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Line items</CardTitle>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus /> Add item
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="hidden gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1fr_84px_120px_120px_36px]">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit (ZEC)</span>
                <span className="text-right">Line total</span>
                <span />
              </div>
              {items.map((li, idx) => {
                const lineZec = (li.quantity || 0) * (li.unitPriceZec || 0);
                return (
                  <div
                    key={idx}
                    className="grid gap-3 sm:grid-cols-[1fr_84px_120px_120px_36px] sm:items-center"
                  >
                    <Input
                      placeholder="e.g. Brand identity & design system"
                      value={li.description}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      value={li.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: Number(e.target.value) })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={li.unitPriceZec}
                      onChange={(e) =>
                        updateItem(idx, {
                          unitPriceZec: Number(e.target.value),
                        })
                      }
                    />
                    <div className="text-right text-sm font-medium tabular-nums">
                      {lineZec.toFixed(2)} ZEC
                      <div className="text-xs font-normal text-muted-foreground">
                        {formatKes(zecToKes(lineZec))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Summary rail */}
        <div className="space-y-5">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Total</CardTitle>
              <CardDescription>
                Live KES at 1 ZEC = {formatKes(ZEC_TO_KES)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-semibold tabular-nums">
                  {formatZec(Number(totalZec.toFixed(8)))}
                </div>
                <div className="text-muted-foreground tabular-nums">
                  ≈ {formatKes(totalKes)}
                </div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                The customer pays this amount to a shielded unified address. The
                invoice reference travels inside the encrypted 512-byte memo, so
                the payment auto-reconciles on arrival.
              </p>
              <Button
                className="w-full"
                disabled={!canSave}
                onClick={onSave}
              >
                Create & generate payment request <ArrowRight />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
