"use client";

import { useState } from "react";
import {
  Wind,
  Map as MapIcon,
  Search,
  CheckSquare,
  BarChart3,
  Database,
  Info,
  Menu,
  X,
} from "lucide-react";
import { useDashboard, type View } from "@/lib/dashboard";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { view, setView, lang, setLang } = useDashboard();
  const [mobileOpen, setMobileOpen] = useState(false);
  const L = t(lang);

  const items: { view: View; label: string; icon: typeof MapIcon }[] = [
    { view: "map", label: L.navMap, icon: MapIcon },
    { view: "investigate", label: L.navInvestigate, icon: Search },
    { view: "actions", label: L.navActions, icon: CheckSquare },
    { view: "analytics", label: L.navAnalytics, icon: BarChart3 },
    { view: "sources", label: L.navSources, icon: Database },
    { view: "about", label: L.navAbout, icon: Info },
  ];

  const go = (v: View) => {
    setView(v);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-dd-border bg-dd-header/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-3 px-3 sm:px-4">
        <button
          onClick={() => go("map")}
          className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-left"
          aria-label="Dhuan Detective home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-dd-accent to-dd-accent2 shadow-glow">
            <Wind className="h-5 w-5 text-[#04121c]" />
          </span>
          <span>
            <span className="block text-sm font-bold leading-tight text-dd-text">Dhuan Detective</span>
            <span className="hidden text-[11px] leading-tight text-dd-muted sm:block">{L.subtitle}</span>
          </span>
        </button>

        <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 md:flex">
          {items.map((it) => {
            const Icon = it.icon;
            const active = view === it.view;
            return (
              <button
                key={it.view}
                onClick={() => go(it.view)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-dd-elev text-dd-text"
                    : "text-dd-muted hover:bg-dd-elev/60 hover:text-dd-text"
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "en" | "hi")}
            aria-label="Language"
            className="h-9 rounded-lg border border-dd-border bg-dd-card px-2 text-sm text-dd-text"
          >
            <option value="en">EN</option>
            <option value="hi">हिन्दी</option>
          </select>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            className="rounded-lg border border-dd-border p-2 text-dd-text md:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile" className="border-t border-dd-border bg-dd-header px-3 py-2 md:hidden">
          <div className="flex flex-col">
            {items.map((it) => {
              const Icon = it.icon;
              const active = view === it.view;
              return (
                <button
                  key={it.view}
                  onClick={() => go(it.view)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                    active ? "bg-dd-elev text-dd-text" : "text-dd-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {it.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
