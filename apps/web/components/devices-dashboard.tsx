"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { DeviceLink, StatCard } from "@/components/nms-ui";
import { fetchReportDevices, fetchReportSummary } from "@/lib/api";

export function DevicesDashboard() {
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState("all");
  const [site, setSite] = useState("all");
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
  const sites = Array.from(new Set(devices.map((device) => device.siteKey))).sort();
  const filteredDevices = useMemo(() => devices.filter((device) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || `${device.name} ${device.deviceId} ${device.siteKey} ${device.type}`.toLowerCase().includes(needle);
    const matchesHealth = health === "all" || device.health === health;
    const matchesSite = site === "all" || device.siteKey === site;
    return matchesSearch && matchesHealth && matchesSite;
  }), [devices, health, search, site]);

  return (
    <DashboardShell title="Devices" subtitle="All monitored devices discovered from site relations.">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Devices" value={summaryQuery.data?.summary.deviceCount ?? devices.length} note="Total network devices" />
        <StatCard title="Online" value={summaryQuery.data?.summary.onlineDeviceCount ?? 0} note="Reachability based" status="normal" />
        <StatCard title="Stale" value={summaryQuery.data?.summary.staleDeviceCount ?? 0} note="Telemetry older than 5 min" status={summaryQuery.data?.summary.staleDeviceCount ? "warning" : "normal"} />
      </section>

      <section className="border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 bg-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold text-slate-800">Device Inventory</p><p className="mt-0.5 text-[11px] text-slate-600">{filteredDevices.length} of {devices.length} devices</p></div>
            <div className="flex flex-wrap gap-2">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search device..." className="w-48 border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-700" />
              <select value={site} onChange={(event) => setSite(event.target.value)} className="border border-slate-300 bg-white px-2 py-1.5 text-xs"><option value="all">All sites</option>{sites.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={health} onChange={(event) => setHealth(event.target.value)} className="border border-slate-300 bg-white px-2 py-1.5 text-xs"><option value="all">All health</option><option value="normal">Normal</option><option value="warning">Warning</option><option value="critical">Critical</option><option value="unknown">Unknown</option></select>
            </div>
          </div>
        </div>
        {devicesQuery.isLoading ? <p className="px-4 py-5 text-xs text-slate-600">Loading devices...</p> : null}
        <div className="divide-y divide-slate-200">
          {filteredDevices.map((device) => (
            <DeviceLink key={device.deviceId} href={`/devices/${device.deviceId}${device.siteKey ? `?site=${device.siteKey}` : ""}`} name={device.name} type={`${device.type}${device.siteKey ? ` · ${device.siteKey}` : ""}`} status={device.health} />
          ))}
          {!devicesQuery.isLoading && filteredDevices.length === 0 ? <p className="px-4 py-8 text-center text-xs text-slate-600">No devices match current filters.</p> : null}
        </div>
      </section>
    </DashboardShell>
  );
}
