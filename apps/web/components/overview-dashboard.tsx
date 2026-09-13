"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { FreshnessStrip, StatusBadge } from "@/components/nms-ui";
import { fetchAlarms, fetchReportOverview, fetchSites } from "@/lib/api";
import { formatDateTime, formatPercent, formatRelativeTime, freshnessState } from "@/lib/format";
import type { Alarm, ReportDeviceRow, ReportSiteRow } from "@/lib/types";

const SiteMapPanel = dynamic(() => import("@/components/site-map-panel").then((mod) => mod.SiteMapPanel), {
  ssr: false,
});

export function OverviewDashboard() {
  const queryClient = useQueryClient();
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 60_000, staleTime: 30_000 });
  const overviewQuery = useQuery({ queryKey: ["overview", "24h"], queryFn: () => fetchReportOverview("24h"), refetchInterval: 60_000, staleTime: 30_000 });
  const alarmsQuery = useQuery({ queryKey: ["alarms", "overview-active"], queryFn: () => fetchAlarms({ searchStatus: "ACTIVE", pageSize: 7 }), refetchInterval: 60_000, staleTime: 30_000 });

  const summary = overviewQuery.data?.summary;
  const siteRows = overviewQuery.data?.sites || overviewQuery.data?.topSitesByAlarms || [];
  const issueDevices = (overviewQuery.data?.topDevicesByIssues || []).filter((device) => device.health === "critical" || device.health === "warning").slice(0, 5);
  const alarms = alarmsQuery.data?.items?.slice(0, 7) || [];
  const totalDeviceCount = summary?.deviceCount ?? 0;
  const onlineDeviceCount = summary?.onlineDeviceCount ?? 0;
  const onlinePct = totalDeviceCount > 0 ? (onlineDeviceCount / totalDeviceCount) * 100 : 0;
  const criticalDeviceCount = issueDevices.filter((device) => device.health === "critical").length;
  const warningDeviceCount = issueDevices.filter((device) => device.health === "warning").length;
  const activeAlarmCount = alarmsQuery.data?.totalElements ?? summary?.activeAlarmCount ?? 0;
  const alarmCriticalCount = summary?.criticalAlarmCount ?? alarms.filter((a) => a.severity === "CRITICAL" || a.severity === "MAJOR").length;
  const criticalSiteCount = siteRows.filter((site) => site.health === "critical").length;
  const warningSiteCount = siteRows.filter((site) => site.health === "warning").length;
  const lastUpdated = latestTimestamp([overviewQuery.data?.generatedAt, overviewQuery.data?.range?.endAt]);
  const refreshing = overviewQuery.isFetching || sitesQuery.isFetching || alarmsQuery.isFetching;
  const siteMapItems: SiteMapItem[] = (sitesQuery.data?.items || [])
    .filter((site) => site.latitude !== undefined && site.longitude !== undefined && (site.latitude !== 0 || site.longitude !== 0))
    .map((site) => {
      const report = siteRows.find((item) => item.siteKey === site.siteKey);
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
    void queryClient.invalidateQueries({ queryKey: ["overview", "24h"] });
    void queryClient.invalidateQueries({ queryKey: ["alarms", "overview-active"] });
  };
  const freshestDeviceUpdate = latestTimestamp((overviewQuery.data?.devices || []).map((device) => device.updatedAt));
  const currentDeviceCount = (overviewQuery.data?.devices || []).filter((device) => freshnessState(device.updatedAt) === "current").length;

  return (
    <DashboardShell
      title="Overview"
      subtitle=""
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden border border-slate-300 bg-slate-50 px-2.5 py-1 text-right text-[10px] text-slate-600 sm:block">
            <p className="font-semibold text-slate-800">{lastUpdated ? formatRelativeTime(lastUpdated) : "not loaded"}</p>
            <p>{lastUpdated ? formatDateTime(lastUpdated) : "Waiting"}</p>
          </div>
           <button type="button" onClick={refreshOverview} disabled={refreshing} className="rounded-sm border border-blue-800 bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:border-slate-400 disabled:bg-slate-400">
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      }
    >
      {overviewQuery.error || sitesQuery.error || alarmsQuery.error ? <p className="border border-red-200 bg-red-100 px-3 py-2 text-xs text-red-800">{(overviewQuery.error || sitesQuery.error || alarmsQuery.error)?.message}</p> : null}

      <FreshnessStrip updatedAt={freshestDeviceUpdate} currentCount={currentDeviceCount} totalCount={totalDeviceCount} />

      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat title="Sites" value={summary?.siteCount ?? siteRows.length} note={`${criticalSiteCount} critical / ${warningSiteCount} warning`} status={criticalSiteCount > 0 ? "critical" : warningSiteCount > 0 ? "warning" : "normal"} />
        <MiniStat title="Devices" value={totalDeviceCount} note="Total monitored" />
        <MiniStat title="Online" value={`${onlineDeviceCount}/${totalDeviceCount || 0}`} note={`${formatPercent(onlinePct)} reachable`} status={onlinePct < 90 ? "warning" : "normal"} />
        <MiniStat title="Warning" value={warningDeviceCount} note="Devices with issues" status={warningDeviceCount > 0 ? "warning" : "normal"} />
        <MiniStat title="Critical" value={criticalDeviceCount} note="Immediate action" status={criticalDeviceCount > 0 ? "critical" : "normal"} />
        <MiniStat title="Alarms" value={activeAlarmCount} note={`${alarmCriticalCount} critical`} status={activeAlarmCount > 0 ? "warning" : "normal"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.85fr_1.05fr_1.1fr]">
        <Panel title="Site Health" action={<Link href="/sites" className="border border-blue-800 bg-blue-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-800">Sites</Link>}>
          <div className="divide-y divide-slate-200">
            {siteRows.slice(0, 4).map((site) => <SiteHealthRow key={site.siteKey} site={site} />)}
            {siteRows.length === 0 ? <EmptyLine text="No site data" /> : null}
          </div>
        </Panel>

        <Panel title="Critical / Warning Devices" action={<Link href="/devices" className="border border-blue-800 bg-blue-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-800">Devices</Link>}>
          <div className="divide-y divide-slate-200">
            {issueDevices.map((device) => <IssueDeviceRow key={device.deviceId} device={device} />)}
            {issueDevices.length === 0 ? <EmptyLine text="No issue devices" /> : null}
          </div>
        </Panel>

        <Panel title="Active Alarms" action={<Link href="/alarms" className="border border-blue-800 bg-blue-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-800">Alarms</Link>}>
          <div className="divide-y divide-slate-200">
            {alarms.map((alarm) => <AlarmRow key={alarm.alarmId} alarm={alarm} />)}
            {alarms.length === 0 ? <EmptyLine text="No active alarms" /> : null}
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SiteMapPanel items={siteMapItems} totalSites={sitesQuery.data?.items.length || 0} missingCoordinateCount={missingCoordinateCount} compact />
        <Panel title="Reachability">
          <div className="space-y-3 p-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                <span>Online devices</span>
                <span className="font-semibold text-slate-950">{formatPercent(onlinePct)}</span>
              </div>
              <div className="h-2 border border-slate-300 bg-slate-100">
                <div className="h-full bg-blue-700" style={{ width: `${Math.min(100, Math.max(0, onlinePct))}%` }} />
              </div>
            </div>
            <SignalLine label="Stale telemetry" value={summary?.staleDeviceCount ?? 0} status={(summary?.staleDeviceCount ?? 0) > 0 ? "warning" : "normal"} />
            <SignalLine label="Data source" value={overviewQuery.data?.source || "postgres"} status="normal" />
            <SignalLine label="Mapped sites" value={`${siteMapItems.length}/${sitesQuery.data?.items.length || 0}`} status={missingCoordinateCount > 0 ? "warning" : "normal"} />
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}

function MiniStat({ title, value, note, status }: { title: string; value: string | number; note?: string; status?: string }) {
  return (
    <div className={`rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm ${status ? `border-l-4 ${statusBorderClass(status)}` : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.03em] text-slate-600">{title}</p>
          <p className="text-lg font-semibold leading-5 text-slate-950">{value}</p>
          {note ? <p className="truncate text-[10px] text-slate-600">{note}</p> : null}
        </div>
        {status ? <StatusBadge status={status} /> : null}
      </div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-0 rounded-md border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center justify-between rounded-t-md border-b border-slate-300 bg-slate-100 px-3 py-2">
        <p className="text-xs font-semibold text-slate-800">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function SiteHealthRow({ site }: { site: ReportSiteRow }) {
  return (
    <Link href={`/sites/${site.siteKey}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2 hover:bg-slate-100">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-950">{site.siteName}</p>
        <p className="text-[10px] text-slate-600">{site.onlineDeviceCount}/{site.deviceCount} online · {site.activeAlarmCount} alarms</p>
      </div>
      <StatusBadge status={site.health} />
    </Link>
  );
}

function IssueDeviceRow({ device }: { device: ReportDeviceRow }) {
  const href = `/devices/${device.deviceId}${device.siteKey ? `?site=${device.siteKey}` : ""}`;
  return (
    <Link href={href} className={`block border-l-4 px-3 py-2 transition hover:bg-slate-100 ${device.health === "critical" ? "border-l-red-600" : "border-l-amber-500"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-950">{device.name}</p>
          <p className="truncate text-[10px] uppercase tracking-[0.02em] text-slate-600">{device.siteKey} · {device.type}</p>
        </div>
        <StatusBadge status={device.health} />
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-slate-700">
        <IssueMetric label="CPU" value={formatPercent(device.cpuAvgPct)} tone={metricTone(device.cpuAvgPct, 90, 75)} />
        <IssueMetric label="Loss" value={formatPercent(device.packetLossPct)} tone={metricTone(device.packetLossPct, 10, 5)} />
        <IssueMetric label="Lat" value={`${device.avgLatencyMs.toFixed(0)} ms`} tone={metricTone(device.avgLatencyMs, 250, 100)} />
        <IssueMetric label="Alm" value={device.alarmCount} tone={device.alarmCount > 0 ? "warning" : "normal"} />
      </div>
    </Link>
  );
}

function AlarmRow({ alarm }: { alarm: Alarm }) {
  const status = alarm.severity === "CRITICAL" ? "critical" : alarm.severity === "WARNING" || alarm.severity === "MAJOR" || alarm.severity === "MINOR" ? "warning" : "unknown";
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-3 py-2">
      <StatusBadge status={status} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-950">{alarm.type}</p>
        <p className="truncate text-[10px] text-slate-600">{alarm.originatorLabel || alarm.originatorName || "-"} · {alarm.createdAt ? formatRelativeTime(alarm.createdAt) : "-"}</p>
      </div>
    </div>
  );
}

function SignalLine({ label, value, status }: { label: string; value: string | number; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-slate-200 bg-slate-50 px-2.5 py-2">
      <span className="text-xs text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-950">{value}</span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function IssueMetric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <span className={`border px-1 py-0.5 ${tone === "critical" ? "border-red-200 bg-red-50 text-red-800" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{label} {value}</span>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="px-3 py-6 text-center text-xs text-slate-600">{text}</p>;
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

function statusBorderClass(status: string) {
  switch (status) {
    case "normal":
    case "fresh":
    case "online":
    case "active":
      return "border-l-emerald-500";
    case "warning":
    case "stale":
      return "border-l-amber-500";
    case "critical":
    case "offline":
      return "border-l-red-600";
    default:
      return "border-l-slate-400";
  }
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
