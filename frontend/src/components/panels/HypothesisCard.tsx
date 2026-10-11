import { confidenceTone, sortHypotheses } from "@/lib/investigate";
import type { Hypothesis } from "@/lib/types";
import { Badge } from "@/components/ui";

const CONFIDENCE_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

export function HypothesisCard({ h }: { h: Hypothesis }) {
  const tone = confidenceTone(h.confidence);
  return (
    <div className="rounded-2xl border border-dd-border bg-dd-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-dd-text">
            {h.source.name || h.source.label}
          </h3>
          <p className="text-xs text-dd-muted">
            {h.source.label} · {h.source.distance_km.toFixed(2)} km ·{" "}
            {h.source.upwind === null
              ? "upwind status unknown"
              : h.source.upwind
              ? "upwind of receiver"
              : "not upwind"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={tone}>{CONFIDENCE_LABEL[h.confidence]} confidence</Badge>
          <a
            href={h.source.osm_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-dd-accent2 underline"
          >
            OSM
          </a>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase text-dd-accent">Supporting</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-dd-text/90">
            {h.supporting_evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-dd-warn">Contradicting</p>
          {h.contradicting_evidence.length ? (
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-dd-text/90">
              {h.contradicting_evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-dd-muted">none identified</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-dd-muted">
        <span className="font-semibold uppercase">Uncertainty: </span>
        {h.uncertainty.join(" · ")}
      </p>
    </div>
  );
}

export function ranked(hypotheses: Hypothesis[]): Hypothesis[] {
  return sortHypotheses(hypotheses);
}
