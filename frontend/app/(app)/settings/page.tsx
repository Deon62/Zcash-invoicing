"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Coins, Info, RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/PageHeader";
import { useZcash } from "@/lib/useZcash";
import { resetDemo, ZEC_TO_KES } from "@/lib/zcashService";
import { BRAND } from "@/lib/brand";

export default function SettingsPage() {
  useZcash();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Settings"
        description="Preferences and demo controls for your Arelis workspace."
      />

      {/* Display / currency */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-4 text-primary" /> Currency &amp; display
          </CardTitle>
          <CardDescription>How amounts are shown across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Reporting currency" value="KES (Kenyan Shilling)" />
          <Separator />
          <Row label="Settlement asset" value="ZEC (shielded)" />
          <Separator />
          <Row label="Spot rate (mocked)" value={`1 ZEC ≈ ${ZEC_TO_KES.toLocaleString()} KES`} />
        </CardContent>
      </Card>

      {/* Demo data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="size-4 text-primary" /> Demo data
          </CardTitle>
          <CardDescription>
            Restore the workspace to its original seed data — invoices, customers
            and any disclosure packs you generated are reset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.04] px-4 py-3">
              <span className="text-sm">This clears all changes you&rsquo;ve made. Continue?</span>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await resetDemo();
                    router.push("/dashboard");
                  }}
                >
                  Reset demo
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              <RotateCcw className="size-3.5" /> Reset demo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4 text-primary" /> About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">{BRAND.name}</div>
          <div>{BRAND.tagline}</div>
          <div className="text-xs">
            Prototype with mock data — no live Zcash integration yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
