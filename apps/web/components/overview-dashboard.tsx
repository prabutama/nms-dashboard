"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { DeviceLink, StatCard, StatusBadge } from "@/components/nms-ui";
import { fetchAlarms, fetchAttributes, fetchReportSites, fetchReportSummary, fetchSites } from "@/lib/api";

const SiteMapPanel = dynamic(() => import("@/components/site-map-panel").then((mod) => mod.SiteMapPanel), {
  ssr: false,
});

export function OverviewDashboard() {
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 60_000 });
  const activeAlarmsQuery = useQuery({
    queryKey: ["alarms", "overview"],
    queryFn: () => fetchAlarms({ searchStatus: "ACTIVE" }),
    refetchInterval: 30_000,
  });
  const allAlarmsQuery = useQuery({
    queryKey: ["alarms", "overview-all"],
    queryFn: () => fetchAlarms({ pageSize: 5 }),
    refetchInterval: 60_000,
  });
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
  const siteAttributeQueries = useQueries({
    queries: (sitesQuery.data?.items || []).map((site) => ({
      queryKey: ["site-attributes", site.assetId],
      queryFn: () => fetchAttributes("assets", site.assetId),
      enabled: sitesQuery.data !== undefined,
      refetchInterval: 60_000,
    })),
  });
  const topIssueDevices = summaryQuery.data?.topDevicesByIssues || [];
  const criticalDevices = topIssueDevices.filter((device) => device.health === "critical").slice(0, 6);
  const staleCount = summaryQuery.data?.summary.staleDeviceCount ?? 0;

  const activeAlarmCount = activeAlarmsQuery.data?.totalElements ?? 0;
  const alarmCriticalCount = (activeAlarmsQuery.data?.items || []).filter((a) => a.severity === "CRITICAL" || a.severity === "MAJOR").length;
  const recentAlarms = allAlarmsQuery.data?.items?.slice(0, 5) || [];
  const siteMapItems = (sitesQuery.data?.items || [])
    .map((site, index) => buildSiteMapItem(site, siteAttributeQueries[index]?.data, reportSitesQuery.data?.items.find((item) => item.siteKey === site.siteKey)))
    .filter((item): item is SiteMapItem => item !== null);
  const missingCoordinateCount = (sitesQuery.data?.items.length || 0) - siteMapItems.length;

  return (
    <DashboardShell title="Overview" subtitle="High-level network health across monitored sites and devices.">
      {sitesQuery.error ? <p className="border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{sitesQuery.error.message}</p> : null}

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard title="Sites" value={sitesQuery.data?.items.length || 0} note="ThingsBoard assets" />
        <StatCard title="Devices" value={summaryQuery.data?.summary.deviceCount ?? 0} note="Total network devices" />
        <StatCard title="Online" value={summaryQuery.data?.summary.onlineDeviceCount ?? 0} note="Reachability based" status="normal" />
        <StatCard title="Active Alarms" value={activeAlarmCount} note={`${alarmCriticalCount} critical/major`} status={activeAlarmCount > 0 ? "warning" : "normal"} />
        <StatCard title="Critical Devices" value={criticalDevices.length} note="From sampled dashboards" status={criticalDevices.length > 0 ? "critical" : "normal"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Critical & Warning Devices</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Derived from aggregated device reports.</p>
            </div>
            <Link href="/devices" className="bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700">View devices</Link>
          </div>
          {summaryQuery.isLoading ? <p className="px-4 py-5 text-xs text-slate-500">Loading device health...</p> : null}
          {criticalDevices.length === 0 ? <p className="border-b border-slate-100 px-4 py-5 text-xs text-slate-500">No critical devices among the sampled set.</p> : null}
          {criticalDevices.map((device) => (
            <DeviceLink key={device.deviceId} href={`/devices/${device.deviceId}${device.siteKey ? `?site=${device.siteKey}` : ""}`} name={device.name} type={device.type} status={device.health} />
          ))}
        </div>

        <div className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-700">Summary Indicators</p>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-slate-600">Stale telemetry</span>
              <StatusBadge status={staleCount > 0 ? "warning" : "normal"} />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-slate-600">ThingsBoard inventory</span>
              <StatusBadge status={sitesQuery.data ? "normal" : "unknown"} />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-slate-600">Active alarms</span>
              <StatusBadge status={activeAlarmCount > 0 ? "warning" : "normal"} />
            </div>
          </div>
        </div>
      </div>

      <SiteMapPanel items={siteMapItems} totalSites={sitesQuery.data?.items.length || 0} missingCoordinateCount={missingCoordinateCount} />

      {recentAlarms.length > 0 ? (
        <div className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Recent Alarms</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Latest events across all devices.</p>
            </div>
            <Link href="/alarms" className="bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 font-medium text-slate-500">Severity</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Type</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Originator</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAlarms.map((alarm) => (
                  <tr key={alarm.alarmId}>
                    <td className="px-4 py-2"><StatusBadge status={alarm.severity === "CRITICAL" ? "critical" : alarm.severity === "WARNING" || alarm.severity === "MAJOR" || alarm.severity === "MINOR" ? "warning" : "unknown"} /></td>
                    <td className="px-4 py-2 font-medium text-slate-950">{alarm.type}</td>
                    <td className="px-4 py-2 text-slate-600">{alarm.originatorLabel || alarm.originatorName || "-"}</td>
                    <td className="px-4 py-2 text-slate-600">{alarm.status}</td>
                    <td className="px-4 py-2 text-slate-600">{alarm.createdAt ? new Date(alarm.createdAt).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

type SiteMapItem = {
  siteKey: string;
  name: string;
  latitude: number;
  longitude: number;
  deviceCount: number;
  onlineDeviceCount: number;
  activeAlarmCount: number;
  health: string;
};

function buildSiteMapItem(
  site: { siteKey: string; name: string },
  data: Awaited<ReturnType<typeof fetchAttributes>> | undefined,
  reportSite?: Awaited<ReturnType<typeof fetchReportSites>>["items"][number],
) {
  if (!data) {
    return null;
  }
  const latitude = readCoordinate(data, "latitude");
  const longitude = readCoordinate(data, "longitude");
  if (latitude === null || longitude === null) {
    return null;
  }
  return {
    siteKey: site.siteKey,
    name: site.name,
    latitude,
    longitude,
    deviceCount: reportSite?.deviceCount ?? 0,
    onlineDeviceCount: reportSite?.onlineDeviceCount ?? 0,
    activeAlarmCount: reportSite?.activeAlarmCount ?? 0,
    health: reportSite?.health ?? "unknown",
  };
}

function readCoordinate(data: Awaited<ReturnType<typeof fetchAttributes>>, key: string) {
  for (const items of Object.values(data.scopes)) {
    const entry = items.find((item) => item.key.toLowerCase() === key);
    if (!entry) {
      continue;
    }
    const numeric = Number(entry.value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}
