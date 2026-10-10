"use client";

import { Database, MapPinned } from "lucide-react";
import { Badge, Card, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { formatCount as n } from "@/lib/utils";
import type { LocationStats } from "@/lib/types";

interface Props {
  stats: LocationStats | null;
  loading: boolean;
  error: string | null;
}

/** Compact coverage strip shown near the search bar. */
export function CoverageCompact({ stats, loading, error }: Props) {
  if (loading) return <Skeleton className="h-5 w-72 max-w-full" />;
  if (error || !stats) {
    return <span className="text-xs text-slate-400">Live location coverage unavailable</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      <Badge tone="neutral">
        <MapPinned className="mr-1 h-3 w-3" /> Delhi NCR coverage
      </Badge>
      <span>
        <strong className="tabular-nums">{n(stats.total_locations)}</strong> locations indexed
      </span>
      <span aria-hidden>·</span>
      <span>
        <strong className="tabular-nums">{n(stats.locations_with_observations)}</strong> with pollution data
      </span>
      {stats.last_update && (
        <>
          <span aria-hidden>·</span>
          <span className="text-slate-400">updated {new Date(stats.last_update).toLocaleString()}</span>
        </>
      )}
    </div>
  );
}

/** Full coverage panel for the dashboard. Distinguishes geographic vs environmental coverage. */
export function CoveragePanel({ stats, loading, error }: Props) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Coverage</CardTitle>
        <Badge tone="neutral">
          <Database className="mr-1 h-3 w-3" />
          {loading ? "Loading…" : error || !stats ? "Offline" : "Live dataset"}
        </Badge>
      </CardHeader>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : error || !stats ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Live location coverage is currently unavailable.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Locations indexed" value={n(stats.total_locations)} />
            <Stat label="With pollution data" value={n(stats.locations_with_observations)} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {stats.sources.locations} · observations: {stats.sources.observations}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.by_category)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([k, v]) => (
                <Badge key={k} tone="neutral">
                  {k.replace(/_/g, " ")} {n(v)}
                </Badge>
              ))}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Geographic coverage ≠ environmental coverage — most indexed points have no measurement
            ({n(stats.total_locations - stats.locations_with_observations)} without a pollution
            reading).
          </p>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
      <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
