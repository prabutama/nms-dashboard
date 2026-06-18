"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { DeviceLink, StatCard } from "@/components/nms-ui";
import { fetchReportSummary, fetchSiteDevices, fetchSites } from "@/lib/api";

export function DevicesDashboard() {
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 60_000 });
  const summaryQuery = useQuery({
    queryKey: ["report-summary", "24h"],
    queryFn: () => fetchReportSummary("24h"),
    refetchInterval: 60_000,
  });
  const deviceQueries = useQueries({
    queries: (sitesQuery.data?.items || []).map((site) => ({
      queryKey: ["site-devices", site.siteKey],
      queryFn: () => fetchSiteDevices(site.siteKey),
      enabled: sitesQuery.data !== undefined,
      refetchInterval: 60_000,
    })),
  });
  const devices = deviceQueries.flatMap((query, index) => (query.data?.items || []).map((device) => ({ ...device, siteKey: sitesQuery.data?.items[index]?.siteKey })));

  return (
    <DashboardShell title="Devices" subtitle="All monitored devices discovered from site relations.">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Devices" value={summaryQuery.data?.summary.deviceCount ?? devices.length} note="Total network devices" />
        <StatCard title="Online" value={summaryQuery.data?.summary.onlineDeviceCount ?? 0} note="Reachable with fresh telemetry" status="normal" />
        <StatCard title="Stale" value={summaryQuery.data?.summary.staleDeviceCount ?? 0} note="Telemetry older than 5 min" status={summaryQuery.data?.summary.staleDeviceCount ? "warning" : "normal"} />
      </section>

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">Device Inventory</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Select a device to view operational metrics and charts.</p>
        </div>
        {sitesQuery.isLoading || deviceQueries.some((query) => query.isLoading) ? <p className="px-4 py-5 text-xs text-slate-500">Loading devices...</p> : null}
        <div className="divide-y divide-slate-100">
          {devices.map((device) => (
            <DeviceLink key={device.deviceId} href={`/devices/${device.deviceId}${device.siteKey ? `?site=${device.siteKey}` : ""}`} name={device.label || device.name} type={`${device.type}${device.siteKey ? ` · ${device.siteKey}` : ""}`} status="unknown" />
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
