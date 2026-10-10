import * as React from "react";
import { cn } from "@/lib/utils";

/* --------------------------------- Button --------------------------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-dd-accent text-[#04121c] hover:brightness-110 disabled:hover:brightness-100",
    outline:
      "border border-dd-border text-dd-text hover:bg-dd-elev",
    ghost: "text-dd-muted hover:bg-dd-elev hover:text-dd-text",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[filter,background-color,color] disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

/* ---------------------------------- Card ---------------------------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dd-border bg-dd-card p-4 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-sm font-semibold text-dd-muted uppercase tracking-wide", className)} {...props} />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-2 flex items-center justify-between", className)} {...props} />;
}

/* ---------------------------------- Badge --------------------------------- */
type BadgeTone = "neutral" | "good" | "moderate" | "poor" | "veryPoor" | "severe" | "accent";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-dd-elev text-dd-muted border border-dd-border",
  good: "bg-[rgba(0,229,160,0.15)] text-dd-accent border border-[rgba(0,229,160,0.35)]",
  moderate: "bg-[rgba(245,158,11,0.15)] text-dd-warn border border-[rgba(245,158,11,0.35)]",
  poor: "bg-[rgba(249,115,22,0.15)] text-[#fdba74] border border-[rgba(249,115,22,0.35)]",
  veryPoor: "bg-[rgba(240,68,82,0.15)] text-dd-crit border border-[rgba(240,68,82,0.35)]",
  severe: "bg-[rgba(240,68,82,0.25)] text-dd-crit border border-[rgba(240,68,82,0.5)]",
  accent: "bg-[rgba(34,184,255,0.15)] text-dd-accent2 border border-[rgba(34,184,255,0.35)]",
};
export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className
      )}
      {...props}
    />
  );
}

/* -------------------------------- Skeleton -------------------------------- */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-dd-elev", className)} {...props} />;
}

/* ---------------------------------- Tabs ---------------------------------- */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap rounded-lg border border-dd-border bg-dd-elev p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === it.value
              ? "bg-dd-card text-dd-text shadow-sm"
              : "text-dd-muted hover:text-dd-text"
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- Accordion -------------------------------- */
export function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-xl border border-dd-border">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-dd-text"
      >
        {title}
        <span className="text-dd-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-dd-border px-4 py-3 text-sm text-dd-text/90">{children}</div>
      )}
    </div>
  );
}

/* -------------------------------- Progress -------------------------------- */
export function Gauge({
  value,
  max,
  color = "var(--dd-accent)",
  className,
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-dd-elev", className)}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
