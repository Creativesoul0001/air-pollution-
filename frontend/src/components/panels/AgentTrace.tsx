import { BrainCircuit } from "lucide-react";
import { Accordion } from "@/components/ui";
import type { EstimateResponse } from "@/lib/types";

/** Shows the ACTUAL Strands tool-call trace. Never a hardcoded narrative. */
export function AgentTrace({ data }: { data: EstimateResponse }) {
  const available = data.attribution.attribution_available;
  return (
    <Accordion
      title={
        <span className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-slate-400" />
          How the Detective found this
        </span>
      }
    >
      {!available ? (
        <p className="text-slate-500 dark:text-slate-400">
          Attribution was unavailable for this reading; only the estimate is shown.
        </p>
      ) : data.agent_trace.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">No trace steps recorded.</p>
      ) : (
        <ol className="space-y-2">
          {data.agent_trace.map((s) => (
            <li key={s.step} className="flex gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {s.step}
              </span>
              <div>
                <p className="font-mono text-[13px] text-slate-700 dark:text-slate-200">{s.tool}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.result}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Accordion>
  );
}
