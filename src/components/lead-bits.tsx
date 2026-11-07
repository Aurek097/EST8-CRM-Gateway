import { cn } from "@/lib/utils";

export function TypeTag({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-bold",
        type === "fe" ? "bg-fe-soft text-fe" : "bg-mp-soft text-mp",
      )}
    >
      {type === "fe" ? "FE" : "MP"}
    </span>
  );
}
