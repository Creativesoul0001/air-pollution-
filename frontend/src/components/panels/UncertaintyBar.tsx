import { formatPM25 } from "@/lib/utils";
import type { EstimateResponse } from "@/lib/types";

/** Renders the p10–p90 uncertainty range with the p50 marker. Always shown. */
export function UncertaintyBar({ data }: { data: EstimateResponse }) {
  const { pm25_p10: p10, pm25_p50: p50, pm25_p90: p90 } = data;
  const span = Math.max(1, p90 - p10);
  const pct = (v: number) => ((v - p10) / span) * 100;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Uncertainty range</span>
        <span className="tabular-nums">
          {formatPM25(p10)} – {formatPM25(p90)} µg/m³
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="absolute inset-y-0 bg-gradient-to-r from-amber-300 via-orange-400 to-red-400"
          style={{ left: 0, right: 0 }}
        />
        <div
          className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-slate-900 dark:bg-white"
          style={{ left: `calc(${pct(p50)}% - 2px)` }}
          title={`p50 ${formatPM25(p50)}`}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Model estimate · p50 {formatPM25(p50)}
      </p>
    </div>
  );
}
