import { GraduationCap, Bike, HardHat } from "lucide-react";
import { Tabs } from "@/components/ui";
import type { EstimateResponse, Profile } from "@/lib/types";

export function AdviceCards({
  advice,
  value,
  onChange,
}: {
  advice: EstimateResponse["advice"];
  value: Profile;
  onChange: (p: Profile) => void;
}) {
  return (
    <div className="space-y-3">
      <Tabs<Profile>
        value={value}
        onChange={onChange}
        items={[
          { value: "parent", label: "Parents", icon: <GraduationCap className="h-4 w-4" /> },
          { value: "rider", label: "Riders", icon: <Bike className="h-4 w-4" /> },
          { value: "worker", label: "Workers", icon: <HardHat className="h-4 w-4" /> },
        ]}
      />
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{advice[value]}</p>
    </div>
  );
}
