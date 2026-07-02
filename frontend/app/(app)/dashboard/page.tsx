"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FilePlus2,
  ScanLine,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useZcash } from "@/lib/useZcash";
import {
  getAccountBalanceShielded,
  getBusiness,
  getMonthlySummary,
  listCustomers,
  listInvoices,
} from "@/lib/zcashService";
import { formatKes, formatZec } from "@/lib/utils";

const INK = "#111827";
const GREEN = "#1f9d62";
const AMBER = "#d9a23b";
const SLATE = "#94a3b8";

export default function DashboardPage() {
  useZcash();
  const business = getBusiness();
  const balance = getAccountBalanceShielded();
  const invoices = listInvoices();
  const monthly = getMonthlySummary();
  const customers = listCustomers();

  const paid = invoices.filter((i) => i.status === "paid");
  const outstanding = invoices.filter((i) => i.status === "awaiting_payment");
  const drafts = invoices.filter((i) => i.status === "draft");

  const paidZec = paid.reduce((s, i) => s + i.amountZec, 0);
  const outstandingZec = outstanding.reduce((s, i) => s + i.amountZec, 0);
  const outstandingKes = outstanding.reduce((s, i) => s + i.amountKes, 0);

  const statusData = [
    { name: "Paid", value: paid.length, zec: paidZec, color: GREEN },
    { name: "Outstanding", value: outstanding.length, zec: outstandingZec, color: AMBER },
    { name: "Draft", value: drafts.length, zec: 0, color: SLATE },
  ].filter((d) => d.value > 0);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={`Welcome back, ${business.name.split(" ")[0]}`}
        description="A clean overview of what you've earned, what's outstanding, and what's held privately."
        action={
          <Button asChild>
            <Link href="/invoices/new">
              <FilePlus2 /> New invoice
            </Link>
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Wallet className="size-4" />}
          label="Shielded balance"
          value={formatZec(balance.zec)}
          sub={`≈ ${formatKes(balance.kesEquivalent)}`}
        />
        <Kpi
          icon={<Clock className="size-4" />}
          label="Outstanding"
          value={formatKes(outstandingKes)}
          sub={`${formatZec(Number(outstandingZec.toFixed(8)))} · ${outstanding.length} invoices`}
        />
        <Kpi
          icon={<CheckCircle2 className="size-4" />}
          label="Reconciled receipts"
          value={`${paid.length}`}
          sub={`of ${invoices.length} invoices`}
        />
        <Kpi
          icon={<Users className="size-4" />}
          label="Customers"
          value={`${customers.length}`}
          sub="active this period"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Revenue over time */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>Revenue collected</CardDescription>
            <div className="flex items-end gap-3">
              <CardTitle className="text-3xl tabular-nums">
                {formatKes(balance.kesEquivalent)}
              </CardTitle>
              <span className="pb-1 text-sm text-muted-foreground tabular-nums">
                {formatZec(balance.zec)} · last 6 months
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthly}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={INK} stopOpacity={0.16} />
                      <stop offset="100%" stopColor={INK} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#e5e7eb" }} />
                  <Area
                    type="monotone"
                    dataKey="collectedKes"
                    stroke={INK}
                    strokeWidth={2}
                    fill="url(#rev)"
                    dot={{ r: 3, fill: INK }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Invoice status */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Invoice status</CardTitle>
            <CardDescription>{invoices.length} invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mx-auto h-40 w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {statusData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<StatusTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2.5">
              <StatusLegend color={GREEN} label="Paid" count={paid.length} zec={paidZec} />
              <StatusLegend color={AMBER} label="Outstanding" count={outstanding.length} zec={outstandingZec} />
              <StatusLegend color={SLATE} label="Draft" count={drafts.length} zec={0} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How compliance works — the three-step flow, spelled out */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.05] to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" /> How compliance works
          </CardTitle>
          <CardDescription>
            Private by default, provable on demand — one flow, three steps. Click any step to open it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <FlowStep
            href="/compliance?tab=privacy"
            n={1}
            icon={<Eye className="size-3.5" />}
            title="See the privacy"
            desc="Your receipts are opaque to the public chain. A viewing key makes them readable — to no one else."
          />
          <FlowStep
            href="/compliance?tab=share"
            n={2}
            icon={<FileCheck2 className="size-3.5" />}
            title="Share with auditor"
            desc="You generate a scoped disclosure pack: a date range or specific invoices, and nothing more."
          />
          <FlowStep
            href="/compliance?tab=verify"
            n={3}
            icon={<ScanLine className="size-3.5" />}
            title="Auditor verifies"
            desc="The auditor checks every declared receipt against the chain. Nothing is taken on trust."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/compliance">
            Open compliance <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function FlowStep({
  href,
  n,
  icon,
  title,
  desc,
}: {
  href: string;
  n: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {n}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon} {title}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground tabular-nums">
          {sub}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusLegend({
  color,
  label,
  count,
  zec,
}: {
  color: string;
  label: string;
  count: number;
  zec: number;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">{count}</span>
      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {zec > 0 ? formatZec(Number(zec.toFixed(8))) : "—"}
      </span>
    </div>
  );
}

function RevenueTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { label: string; collectedKes: number; collectedZec: number };
  return (
    <div className="border bg-card px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-foreground">{p.label} 2026</div>
      <div className="mt-1 tabular-nums text-foreground">{formatKes(p.collectedKes)}</div>
      <div className="tabular-nums text-muted-foreground">{formatZec(p.collectedZec)}</div>
    </div>
  );
}

function StatusTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { name: string; value: number; zec: number };
  return (
    <div className="border bg-card px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-foreground">{p.name}</div>
      <div className="tabular-nums text-muted-foreground">
        {p.value} {p.value === 1 ? "invoice" : "invoices"}
        {p.zec > 0 ? ` · ${formatZec(Number(p.zec.toFixed(8)))}` : ""}
      </div>
    </div>
  );
}
