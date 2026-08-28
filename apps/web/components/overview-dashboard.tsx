"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard, StatusBadge } from "@/components/nms-ui";
import { fetchAlarms, fetchReportSites, fetchReportSummary, fetchSites } from "@/lib/api";
import { formatDateTime, formatPercent, formatRelativeTime } from "@/lib/format";
import type { ReportDeviceRow } from "@/lib/types";

const SiteMapPanel = dynamic(() => import("@/components/site-map-panel").then((mod) => mod.SiteMapPanel), {
  ssr: false,
});

export function OverviewDashboard() {
  const queryClient = useQueryClient();
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 60_000, staleTime: 30_000 });
  const activeAlarmsQuery = useQuery({
    queryKey: ["alarms", "overview"],
    queryFn: () => fetchAlarms({ searchStatus: "ACTIVE" }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const allAlarmsQuery = useQuery({
    queryKey: ["alarms", "overview-all"],
    queryFn: () => fetchAlarms({ pageSize: 5 }),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const summaryQuery = useQuery({
    queryKey: ["report-summary", "24h"],
    queryFn: () => fetchReportSummary("24h"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const reportSitesQuery = useQuery({
    queryKey: ["report-sites", "24h"],
    queryFn: () => fetchReportSites("24h"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const topIssueDevices = summaryQuery.data?.topDevicesByIssues || [];
  const issueDevices = topIssueDevices
    .filter((device) => device.health === "critical" || device.health === "warning")
    .slice(0, 6);
  const criticalDeviceCount = topIssueDevices.filter((device) => device.health === "critical").length;
  const warningDeviceCount = topIssueDevices.filter((device) => device.health === "warning").length;
  const siteRows = reportSitesQuery.data?.items || summaryQuery.data?.topSitesByAlarms || [];
  const criticalSiteCount = siteRows.filter((site) => site.health === "critical").length;
  const warningSiteCount = siteRows.filter((site) => site.health === "warning").length;
  const onlineDeviceCount = summaryQuery.data?.summary.onlineDeviceCount ?? 0;
  const totalDeviceCount = summaryQuery.data?.summary.deviceCount ?? 0;
  const onlinePct = totalDeviceCount > 0 ? (onlineDeviceCount / totalDeviceCount) * 100 : 0;
  const staleCount = summaryQuery.data?.summary.staleDeviceCount ?? 0;
  const lastUpdated = latestTimestamp([summaryQuery.data?.generatedAt, reportSitesQuery.data?.range?.endAt]);
  const refreshing = sitesQuery.isFetching || summaryQuery.isFetching || reportSitesQuery.isFetching || activeAlarmsQuery.isFetching || allAlarmsQuery.isFetching;

  const activeAlarmCount = activeAlarmsQuery.data?.totalElements ?? 0;
  const alarmCriticalCount = (activeAlarmsQuery.data?.items || []).filter((a) => a.severity === "CRITICAL" || a.severity === "MAJOR").length;
  const recentAlarms = allAlarmsQuery.data?.items?.slice(0, 5) || [];
  const siteMapItems: SiteMapItem[] = (sitesQuery.data?.items || [])
    .filter((site) => site.latitude !== undefined && site.longitude !== undefined && (site.latitude !== 0 || site.longitude !== 0))
    .map((site) => {
      const report = reportSitesQuery.data?.items.find((item) => item.siteKey === site.siteKey);
      return {
        siteKey: site.siteKey,
        name: site.name,
        latitude: site.latitude!,
        longitude: site.longitude!,
        deviceCount: report?.deviceCount ?? 0,
        onlineDeviceCount: report?.onlineDeviceCount ?? 0,
        activeAlarmCount: report?.activeAlarmCount ?? 0,
        health: report?.health ?? "unknown",
      };
    });
  const missingCoordinateCount = (sitesQuery.data?.items.length || 0) - siteMapItems.length;
  const refreshOverview = () => {
    void queryClient.invalidateQueries({ queryKey: ["sites"] });
    void queryClient.invalidateQueries({ queryKey: ["alarms", "overview"] });
    void queryClient.invalidateQueries({ queryKey: ["alarms", "overview-all"] });
    void queryClient.invalidateQueries({ queryKey: ["report-summary", "24h"] });
    void queryClient.invalidateQueries({ queryKey: ["report-sites", "24h"] });
  };

  return (
    <DashboardShell
      title="Overview"
      subtitle="High-level network health across monitored sites and devices."
      actions={
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <div className="hidden border border-slate-300 bg-slate-50 px-3 py-1.5 text-right text-[11px] text-slate-600 sm:block">
            <p className="font-semibold text-slate-800">{lastUpdated ? formatRelativeTime(lastUpdated) : "not loaded"}</p>
            <p>{lastUpdated ? formatDateTime(lastUpdated) : "Waiting for reports"}</p>
          </div>
          <button
            type="button"
            onClick={refreshOverview}
            disabled={refreshing}
            className="border border-blue-800 bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:border-slate-400 disabled:bg-slate-400"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      }
    >
      {sitesQuery.error ? <p className="border border-red-200 bg-red-100 px-4 py-3 text-sm text-red-800">{sitesQuery.error.message}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Sites" value={sitesQuery.data?.items.length || 0} note={`${criticalSiteCount} critical · ${warningSiteCount} warning`} status={criticalSiteCount > 0 ? "critical" : warningSiteCount > 0 ? "warning" : "normal"} />
        <StatCard title="Devices" value={totalDeviceCount} note="Total network devices" />
        <StatCard title="Online" value={`${onlineDeviceCount}/${totalDeviceCount || 0}`} note={`${formatPercent(onlinePct)} reachable`} status={staleCount > 0 ? "warning" : "normal"} />
        <StatCard title="Warnings" value={warningDeviceCount} note="From report scoring" status={warningDeviceCount > 0 ? "warning" : "normal"} />
        <StatCard title="Critical" value={criticalDeviceCount} note="Immediate attention" status={criticalDeviceCount > 0 ? "critical" : "normal"} />
        <StatCard title="Active Alarms" value={activeAlarmCount} note={`${alarmCriticalCount} critical/major`} status={activeAlarmCount > 0 ? "warning" : "normal"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Critical & Warning Devices</p>
              <p className="mt-0.5 text-[11px] text-slate-600">Prioritized from CPU, packet loss, latency, freshness, and alarms.</p>
            </div>
            <Link href="/devices" className="border border-blue-800 bg-blue-700 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-800">View devices</Link>
          </div>
          {summaryQuery.isLoading ? <p className="px-4 py-5 text-xs text-slate-600">Loading device health...</p> : null}
          {summaryQuery.error ? <p className="border-b border-red-200 bg-red-50 px-4 py-4 text-xs text-red-800">{summaryQuery.error.message}</p> : null}
          {issueDevices.length === 0 ? <p className="border-b border-slate-200 px-4 py-5 text-xs text-slate-600">No critical or warning devices among the sampled set.</p> : null}
          <div className="divide-y divide-slate-200">
            {issueDevices.map((device) => <IssueDeviceRow key={device.deviceId} device={device} />)}
          </div>
        </div>

        <div className="border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-300 bg-slate-100 px-4 py-3">
            <p className="text-xs font-semibold text-slate-800">Summary Indicators</p>
            <p className="mt-0.5 text-[11px] text-slate-600">Operational signals from latest report window.</p>
          </div>
          <div className="divide-y divide-slate-200">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-slate-700">Stale telemetry</span>
              <StatusBadge status={staleCount > 0 ? "warning" : "normal"} />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-slate-700">ThingsBoard inventory</span>
              <StatusBadge status={sitesQuery.data ? "normal" : "unknown"} />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-slate-700">Active alarms</span>
              <StatusBadge status={activeAlarmCount > 0 ? "warning" : "normal"} />
            </div>
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-700">
                <span>Reachability</span>
                <span className="font-semibold text-slate-950">{formatPercent(onlinePct)}</span>
              </div>
              <div className="h-2 border border-slate-300 bg-slate-100">
                <div className="h-full bg-blue-700" style={{ width: `${Math.min(100, Math.max(0, onlinePct))}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteMapPanel items={siteMapItems} totalSites={sitesQuery.data?.items.length || 0} missingCoordinateCount={missingCoordinateCount} />

      {recentAlarms.length > 0 ? (
        <div className="border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Recent Alarms</p>
              <p className="mt-0.5 text-[11px] text-slate-600">Latest events across all devices.</p>
            </div>
            <Link href="/alarms" className="border border-blue-800 bg-blue-700 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-800">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100/80">
                  <th className="px-4 py-2 font-semibold text-slate-700">Severity</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Originator</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentAlarms.map((alarm) => (
                  <tr key={alarm.alarmId}>
                    <td className="px-4 py-2"><StatusBadge status={alarm.severity === "CRITICAL" ? "critical" : alarm.severity === "WARNING" || alarm.severity === "MAJOR" || alarm.severity === "MINOR" ? "warning" : "unknown"} /></td>
                    <td className="px-4 py-2 font-medium text-slate-950">{alarm.type}</td>
                    <td className="px-4 py-2 text-slate-700">{alarm.originatorLabel || alarm.originatorName || "-"}</td>
                    <td className="px-4 py-2 text-slate-700">{alarm.status}</td>
                    <td className="px-4 py-2 text-slate-700">{alarm.createdAt ? new Date(alarm.createdAt).toLocaleString() : "-"}</td>
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

function IssueDeviceRow({ device }: { device: ReportDeviceRow }) {
  const href = `/devices/${device.deviceId}${device.siteKey ? `?site=${device.siteKey}` : ""}`;
  return (
    <Link href={href} className={`block border-l-4 px-4 py-3 transition hover:bg-slate-100 ${device.health === "critical" ? "border-l-red-600" : "border-l-amber-500"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{device.name}</p>
          <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.02em] text-slate-600">{device.siteKey || "unknown site"} · {device.type}</p>
        </div>
        <StatusBadge status={device.health} />
      </div>
      <div className="mt-3 grid gap-2 text-[11px] text-slate-700 sm:grid-cols-4">
        <IssueMetric label="CPU" value={formatPercent(device.cpuAvgPct)} tone={metricTone(device.cpuAvgPct, 90, 75)} />
        <IssueMetric label="Loss" value={formatPercent(device.packetLossPct)} tone={metricTone(device.packetLossPct, 10, 5)} />
        <IssueMetric label="Latency" value={`${device.avgLatencyMs.toFixed(1)} ms`} tone={metricTone(device.avgLatencyMs, 250, 100)} />
        <IssueMetric label="Updated" value={formatRelativeTime(device.updatedAt)} tone={device.freshness === "fresh" ? "normal" : "warning"} />
      </div>
    </Link>
  );
}

function IssueMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`border px-2 py-1.5 ${tone === "critical" ? "border-red-200 bg-red-50 text-red-800" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
      <p className="font-medium text-slate-600">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function metricTone(value: number, critical: number, warning: number) {
  if (value >= critical) return "critical";
  if (value >= warning) return "warning";
  return "normal";
}

function latestTimestamp(values: Array<string | undefined>) {
  let latest = "";
  let latestMs = 0;
  for (const value of values) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latest = value;
    }
  }
  return latest;
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
