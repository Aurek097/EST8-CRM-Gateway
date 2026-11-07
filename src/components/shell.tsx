import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="text-3xl font-bold text-primary">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      {title && <h2 className="mb-3 eyebrow">{title}</h2>}
      {children}
    </section>
  );
}

export function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}

export function SoonTag() {
  return (
    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
      Coming next
    </span>
  );
}
