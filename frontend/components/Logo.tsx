import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Text wordmark placeholder. The icon/logomark is intentionally omitted —
 * a custom logo will be dropped in here later.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  if (!showWordmark) return null;
  return (
    <div className={cn("leading-tight", className)}>
      <div className="text-base font-semibold tracking-tight">
        {BRAND.name}
      </div>
      <div className="text-[11px] text-muted-foreground">on Zcash</div>
    </div>
  );
}
