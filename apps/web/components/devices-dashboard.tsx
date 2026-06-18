"use client";

import { useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { DeviceLink, StatCard } from "@/components/nms-ui";
import { fetchReportDevices, fetchReportSummary } from "@/lib/api";

export function DevicesDashboard() {
  const summaryQuery = useQuery({
    queryKey: ["report-summary", "24h"],
    queryFn: () => fetchReportSummary("24h"),
    refetchInterval: 60_000,
  });
  const devicesQuery = useQuery({
    queryKey: ["report-devices", "24h"],
    queryFn: () => fetchReportDevices("24h"),
    refetchInterval: 60_000,
  });
  const devices = devicesQuery.data?.items || [];

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
        {devicesQuery.isLoading ? <p className="px-4 py-5 text-xs text-slate-500">Loading devices...</p> : null}
        <div className="divide-y divide-slate-100">
          {devices.map((device) => (
            <DeviceLink key={device.deviceId} href={`/devices/${device.deviceId}${device.siteKey ? `?site=${device.siteKey}` : ""}`} name={device.name} type={`${device.type}${device.siteKey ? ` · ${device.siteKey}` : ""}`} status={device.health} />
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
