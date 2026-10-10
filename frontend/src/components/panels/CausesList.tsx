import { Flame, Factory, Construction, Car, Trash2, Flame as KilnIcon } from "lucide-react";
import { sourceMeta } from "@/lib/constants";
import type { AttributionContributor } from "@/lib/types";

const ICONS: Record<string, React.ReactNode> = {
  landfill: <Trash2 className="h-4 w-4" />,
  construction: <Construction className="h-4 w-4" />,
  industrial: <Factory className="h-4 w-4" />,
  major_junction: <Car className="h-4 w-4" />,
  fire: <Flame className="h-4 w-4" />,
  kiln: <KilnIcon className="h-4 w-4" />,
};

function ConfidenceBadge({ c }: { c: AttributionContributor["confidence"] }) {
  const tone =
    c === "high" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100"
    : c === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${tone}`}>
      {c}
    </span>
  );
}

export function CausesList({ contributors }: { contributors: AttributionContributor[] }) {
  if (contributors.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No mapped pollution sources were found upwind within 5 km. The source database is
        incomplete and treated as improvable.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {contributors.map((c, i) => {
        const meta = sourceMeta(c.type);
        return (
          <li key={`${c.name}-${i}`} className="flex items-center gap-3">
            <span className={`grid h-8 w-8 place-items-center rounded-lg text-white ${meta.color}`}>
              {ICONS[c.type] ?? <Flame className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Likely contributor · {c.distance_km.toFixed(1)} km upwind
              </p>
            </div>
            <ConfidenceBadge c={c.confidence} />
          </li>
        );
      })}
    </ul>
  );
}
