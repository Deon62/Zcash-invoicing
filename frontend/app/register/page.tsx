"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/lib/zcashService";

type Step = "form" | "mnemonic";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [mnemonic, setMnemonic] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [taxPin, setTaxPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await register({ name, taxPin, email, password });
      if (res.mnemonic) {
        setMnemonic(res.mnemonic);
        setStep("mnemonic");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(mnemonic).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleContinue() {
    router.replace("/dashboard");
  }

  if (step === "mnemonic") {
    const words = mnemonic.split(" ");
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-xl space-y-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <Logo />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Save your recovery phrase
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              These 24 words are the only way to recover your wallet if you lose
              access. Write them down and keep them somewhere safe — you will
              not see them again.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {words.map((word, i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-1.5 rounded-md bg-muted px-2.5 py-1.5"
                >
                  <span className="min-w-[1.4rem] text-right font-mono text-xs text-muted-foreground">
                    {i + 1}.
                  </span>
                  <span className="text-sm font-medium text-foreground">{word}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-1.5 size-3.5" />
                {copied ? "Copied!" : "Copy all"}
              </Button>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span className="text-sm leading-snug text-muted-foreground">
              I have written down my 24-word recovery phrase and stored it
              safely. I understand that Arelis cannot recover my wallet without it.
            </span>
          </label>

          <Button
            className="w-full"
            disabled={!confirmed}
            onClick={handleContinue}
          >
            <CheckCircle2 className="mr-2 size-4" />
            I&apos;ve saved my phrase — continue to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/login" className="text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Zira Studio Ltd"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taxPin">Tax PIN</Label>
            <Input
              id="taxPin"
              type="text"
              required
              value={taxPin}
              onChange={(e) => setTaxPin(e.target.value)}
              placeholder="A00XXXXX0A"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
