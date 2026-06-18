"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard, StatusBadge } from "@/components/nms-ui";
import { fetchReportSites, fetchReportSummary, fetchSites } from "@/lib/api";

export function SitesDashboard() {
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 60_000 });
  const summaryQuery = useQuery({
    queryKey: ["report-summary", "24h"],
    queryFn: () => fetchReportSummary("24h"),
    refetchInterval: 60_000,
  });
  const reportSitesQuery = useQuery({
    queryKey: ["report-sites", "24h"],
    queryFn: () => fetchReportSites("24h"),
    refetchInterval: 60_000,
  });
  const reportSites = reportSitesQuery.data?.items || [];
  const totalAlarms = summaryQuery.data?.summary.activeAlarmCount ?? 0;

  return (
    <DashboardShell title="Sites" subtitle="Monitored locations and site-level inventory.">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Sites" value={sitesQuery.data?.items.length || 0} note="Discovered from ThingsBoard" />
        <StatCard title="Devices" value={summaryQuery.data?.summary.deviceCount ?? 0} note="Across all sites" />
        <StatCard title="Alarms" value={totalAlarms} note="Across all sites" status={totalAlarms > 0 ? "warning" : "normal"} />
      </div>

      <div className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">Site Inventory</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Select a site to view devices and summary.</p>
        </div>
        {sitesQuery.isLoading || reportSitesQuery.isLoading ? <p className="px-4 py-5 text-xs text-slate-500">Loading sites...</p> : null}
        {sitesQuery.error ? <p className="px-4 py-5 text-xs text-red-600">{sitesQuery.error.message}</p> : null}
        {reportSitesQuery.error ? <p className="px-4 py-5 text-xs text-red-600">{reportSitesQuery.error.message}</p> : null}
        <div className="divide-y divide-slate-100">
          {(sitesQuery.data?.items || []).map((site) => {
            const reportSite = reportSites.find((item) => item.siteKey === site.siteKey);
            const alarmCount = reportSite?.activeAlarmCount ?? 0;
            const siteStatus = reportSite?.health ?? (alarmCount > 0 ? "warning" : "normal");
            return (
              <Link key={site.assetId} href={`/sites/${site.siteKey}`} className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-blue-50/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-950">{site.name}</p>
                  <p className="truncate text-xs text-slate-500">{site.type}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{reportSite?.deviceCount ?? "--"} devices</span>
                  <span>{alarmCount} alarms</span>
                  <StatusBadge status={siteStatus} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
