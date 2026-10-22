"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { FreshnessStrip, StatusBadge } from "@/components/nms-ui";
import { fetchAlarms, fetchReportOverview, fetchSites } from "@/lib/api";
import { formatDateTime, formatPercent, formatRelativeTime, freshnessState } from "@/lib/format";
import type { Alarm, ReportDeviceRow } from "@/lib/types";

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
  const activeAlarmCount = alarmsQuery.data?.totalElements ?? summary?.activeAlarmCount ?? 0;
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

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
        <span><strong className="font-semibold text-slate-950">{totalDeviceCount}</strong> devices</span>
        <span><strong className="font-semibold text-emerald-700">{onlineDeviceCount}</strong> online</span>
        <span><strong className={`font-semibold ${summary?.staleDeviceCount ? "text-amber-700" : "text-slate-950"}`}>{summary?.staleDeviceCount ?? 0}</strong> stale</span>
        <span><strong className={`font-semibold ${activeAlarmCount ? "text-red-700" : "text-slate-950"}`}>{activeAlarmCount}</strong> active alarms</span>
        <span className="ml-auto text-slate-500">source: <strong className="font-medium text-slate-800">{overviewQuery.data?.source || "postgres"}</strong></span>
      </div>

      <div className="grid items-stretch gap-3 xl:min-h-[calc(100vh-430px)] xl:grid-cols-[minmax(0,2.2fr)_minmax(280px,0.8fr)]">
        <SiteMapPanel items={siteMapItems} totalSites={sitesQuery.data?.items.length || 0} missingCoordinateCount={missingCoordinateCount} compact />
        <Panel title="Reachability" className="h-full">
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

      <Panel title="Operational Events" action={<Link href="/alarms" className="text-[11px] font-medium text-blue-700 hover:underline">Open alarms</Link>}>
        {alarms.length === 0 && issueDevices.length === 0 ? <p className="px-3 py-3 text-xs text-slate-500">No active incidents.</p> : (
          <div className="divide-y divide-slate-200">
            {alarms.slice(0, 5).map((alarm) => <AlarmRow key={alarm.alarmId} alarm={alarm} />)}
            {issueDevices.slice(0, 5).map((device) => <IssueDeviceRow key={device.deviceId} device={device} />)}
          </div>
        )}
      </Panel>
    </DashboardShell>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-0 rounded-md border border-slate-300 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between rounded-t-md border-b border-slate-300 bg-slate-100 px-3 py-2">
        <p className="text-xs font-semibold text-slate-800">{title}</p>
        {action}
      </div>
      {children}
    </div>
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
