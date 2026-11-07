import { cn } from "@/lib/utils";
import logo from "@/assets/est8_logo.webp.asset.json";

export function Est8Mark({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="EST8 Financial Group"
      className={cn("size-9 shrink-0 rounded-full object-cover", className)}
    />
  );
}

export function PartnerLine({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      EST8 CallDesk by EST8 Financial Group · in partnership with Symmetry Financial Group
    </p>
  );
}
