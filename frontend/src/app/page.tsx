"use client";

import { DashboardProvider, useDashboard } from "@/lib/dashboard";
import { AppHeader } from "@/components/AppHeader";
import { SearchAndCoverage } from "@/components/SearchAndCoverage";
import { MapStage } from "@/components/MapStage";
import { LocationPanel } from "@/components/LocationPanel";
import { AnalyticsView, AboutView, DataSourcesView, InvestigateView } from "@/components/views";

function Shell() {
  const { view } = useDashboard();
  return (
    <div className="flex h-screen flex-col bg-dd-bg text-dd-text">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-4">
        {view === "map" && (
          <>
            <SearchAndCoverage />
            <div className="grid min-h-[640px] grid-cols-1 gap-4 lg:h-[calc(100vh-9rem)] lg:grid-cols-[1.6fr_1fr]">
              <div className="h-[55vh] lg:h-full">
                <MapStage />
              </div>
              <div className="lg:h-full lg:overflow-hidden">
                <LocationPanel />
              </div>
            </div>
          </>
        )}
        {view === "investigate" && <InvestigateView />}
        {view === "analytics" && <AnalyticsView />}
        {view === "sources" && <DataSourcesView />}
        {view === "about" && <AboutView />}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  );
}
