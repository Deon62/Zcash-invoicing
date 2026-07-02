import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="bg-background">
      {/* Fixed top bar */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-base font-semibold tracking-tight text-foreground">
            {BRAND.name}
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#reveal" className="transition-colors hover:text-foreground">
              The reveal
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Open app
          </Link>
        </div>
      </header>

      {/* ───────────────── 1 · Hero (single column, clean) ───────────────── */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-3xl px-6 pb-24 pt-40 text-center lg:pt-48">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-6xl">
            Invoicing that keeps your numbers to yourself.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {BRAND.name} is invoicing software for businesses that get paid in
            crypto. Send an invoice, get paid privately, and share verified
            records with your accountant or tax authority — only when you decide
            to.
          </p>
          <div className="mx-auto mt-10 grid max-w-md grid-cols-2 gap-4">
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              Try the live demo
            </Link>
            <a
              href="#how"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full bg-foreground text-background hover:bg-foreground/90"
              )}
            >
              Watch demo
            </a>
          </div>
        </div>
        <div className="flex justify-center pb-8">
          <ChevronDown className="size-5 animate-bounce text-muted-foreground/50" />
        </div>
      </section>

      {/* ───────────────── 2 · How it works (white, title left) ──────────── */}
      <section id="how" className="border-b bg-card">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              From invoice to proof, in four steps.
            </h2>
            <p className="mt-4 max-w-sm text-muted-foreground">
              Everything you already do with invoicing — just private by
              default, and provable when it counts.
            </p>
          </div>
          <ol className="space-y-px border bg-border">
            <Step
              n="01"
              title="Create an invoice"
              body="Add a customer and line items. Amounts show in ZEC with a live local-currency (KES) equivalent for your books."
            />
            <Step
              n="02"
              title="Get paid privately"
              body="Your customer scans a QR and pays in shielded ZEC. The invoice reference travels inside an encrypted memo on the payment."
            />
            <Step
              n="03"
              title="Auto-reconcile"
              body="Arelis matches the incoming payment to the right invoice by memo and amount, and marks it paid — no manual matching."
            />
            <Step
              n="04"
              title="Reveal on demand"
              body="When an auditor needs assurance, you generate a disclosure pack that proves your revenue — and shares nothing else."
            />
          </ol>
        </div>
      </section>

      {/* ───────────────── 3 · The reveal (DARK band) ────────────────────── */}
      <section id="reveal" className="bg-foreground text-background">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
          {/* Cards on the left */}
          <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1">
            <div className="border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-background/60">
                <EyeOff className="size-3.5" /> Public chain
              </div>
              <DarkPair label="Sender" value="u1••••••" />
              <DarkPair label="Amount" value="•••••• ZEC" />
              <DarkPair label="Memo" value="encrypted" last />
            </div>
            <div className="border border-primary/40 bg-primary/[0.08] p-6">
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                <Eye className="size-3.5" /> Auditor view
              </div>
              <DarkPair label="Customer" value="Acacia Digital" bright />
              <DarkPair label="Amount" value="2.40 ZEC" bright />
              <DarkPair label="Status" value="Verified ✓" bright last />
            </div>
          </div>

          {/* Title on the right */}
          <div className="order-1 lg:order-2">
            <p className="text-sm font-medium uppercase tracking-widest text-background/50">
              The reveal
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              One payment. Two truths.
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-background/70">
              To the public chain, every receipt is opaque — no sender, amount,
              or memo. Hand an auditor a viewing key and the same transactions
              become fully readable, line by line. You control exactly which
              records, and for which period.
            </p>
            <Link
              href="/compliance?tab=privacy"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Explore the dual view <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────── 4 · Features (off-white, sharp cards) ──────────── */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Built for trust
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Private from competitors. Clear to your auditor.
            </h2>
          </div>
          <div className="mt-12 grid gap-px border bg-border md:grid-cols-3">
            <Feature
              icon={<Lock className="size-5" />}
              title="Shielded payments"
              body="Get paid in shielded ZEC to a unified address. Competitors and the public chain see nothing — not the amount, sender, or memo."
            />
            <Feature
              icon={<RefreshCw className="size-5" />}
              title="Automatic reconciliation"
              body="Payments match to invoices by encrypted memo and amount, with a local-currency value kept alongside every receipt."
            />
            <Feature
              icon={<KeyRound className="size-5" />}
              title="Selective disclosure"
              body="Share a viewing key for a date range, or a proof for a single payment. Disclosure is always a deliberate choice."
            />
          </div>
        </div>
      </section>

      {/* ───────────────── 5 · Why it matters (white, alternating rows) ───── */}
      <section className="border-b bg-card">
        <div className="mx-auto w-full max-w-6xl space-y-px px-6 py-24">
          <ValueRow
            icon={<ShieldCheck className="size-6" />}
            title="Privacy is the default"
            body="You don't switch privacy on — it's how Arelis works from the first invoice. Nothing about your revenue, customers, or pricing leaks onto a public ledger for rivals to study."
          />
          <ValueRow
            reverse
            icon={<FileText className="size-6" />}
            title="Compliance without oversharing"
            body="When a tax authority or auditor asks, you hand over a clean revenue statement plus the means to verify it on-chain. They confirm what's declared is real — and see nothing beyond the scope you set."
          />
          <ValueRow
            icon={<Wallet className="size-6" />}
            title="Crypto-native, business-ready"
            body="Designed for businesses that already get paid in crypto. Familiar invoicing, with ZEC amounts shown next to a local-currency equivalent so your books still make sense."
          />
        </div>
      </section>

      {/* ───────────────── 6 · FAQ (light gray, title left) ───────────────── */}
      <section id="faq" className="border-b bg-secondary/50">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Questions, answered.
            </h2>
          </div>
          <div className="divide-y border-y bg-card">
            <Faq
              q="Do I need to understand crypto to use Arelis?"
              a="No. If you can send an invoice, you can use Arelis. Your customer pays by scanning a code, and amounts are shown in your local currency alongside ZEC."
            />
            <Faq
              q="Who can see my transactions?"
              a="By default, no one — payments are shielded, so the public chain reveals no sender, receiver, amount, or memo. Only you can see your full activity."
            />
            <Faq
              q="How does sharing records with an auditor work?"
              a="You generate a disclosure pack scoped to a date range or specific invoices. The auditor receives a clean revenue statement and a key to verify each receipt on-chain — nothing outside that scope."
            />
            <Faq
              q="How do customers pay an invoice?"
              a="Each invoice produces a QR code and a unified address. The customer pays in shielded ZEC, and the invoice reference rides inside the encrypted memo so it reconciles automatically."
            />
            <Faq
              q="Is this connected to real Zcash yet?"
              a="Not in this prototype — it runs on realistic sample data so you can walk the full flow end to end. The architecture is built so a real Zcash backend drops in behind the same interface."
            />
          </div>
        </div>
      </section>

      {/* ───────────────── 7 · Final CTA (dark) ───────────────────────────── */}
      <section className="bg-foreground text-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-6 py-24 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              See it work, end to end.
            </h2>
            <p className="mt-4 max-w-md text-background/70">
              Create an invoice, take a shielded payment, and watch an auditor
              verify it on-chain — in a couple of minutes.
            </p>
          </div>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg" }), "shrink-0")}
          >
            Enter the dashboard <ArrowRight />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <span>
            {BRAND.name} · {BRAND.tagline}
          </span>
          <span>Prototype with sample data — no live Zcash integration yet.</span>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- small helpers ----------------------------- */

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-5 bg-card p-6">
      <span className="font-mono text-sm font-semibold text-primary">{n}</span>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </li>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-card p-8">
      <div className="text-foreground">{icon}</div>
      <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function ValueRow({
  icon,
  title,
  body,
  reverse = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-6 border bg-card p-8 md:grid-cols-2 md:gap-12 md:p-12">
      <div className={cn(reverse && "md:order-2")}>
        <div className="flex size-11 items-center justify-center bg-secondary text-foreground">
          {icon}
        </div>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h3>
      </div>
      <p
        className={cn(
          "leading-relaxed text-muted-foreground",
          reverse && "md:order-1"
        )}
      >
        {body}
      </p>
    </div>
  );
}

function DarkPair({
  label,
  value,
  bright = false,
  last = false,
}: {
  label: string;
  value: string;
  bright?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5",
        !last && "border-b border-white/10"
      )}
    >
      <span className="text-xs text-background/50">{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          bright ? "text-background" : "font-mono text-background/60"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group px-6">
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">
        {a}
      </p>
    </details>
  );
}
