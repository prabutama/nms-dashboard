"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard, StatusBadge } from "@/components/nms-ui";
import { fetchReportDevices, fetchReportSites, fetchReportSummary } from "@/lib/api";
import type { ReportDeviceRow, ReportSiteRow } from "@/lib/types";

const RANGES = [
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
];

function csvEscape(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const headerLine = headers.map((h) => csvEscape(h)).join(",");
  const dataLines = rows.map((row) => row.map((c) => csvEscape(c)).join(","));
  const bom = "\uFEFF";
  const csv = bom + [headerLine, ...dataLines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SummaryStrip({ data }: { data: { summary: { siteCount: number; deviceCount: number; onlineDeviceCount: number; staleDeviceCount: number; activeAlarmCount: number; criticalAlarmCount: number } } | undefined }) {
  if (!data) return null;
  const s = data.summary;
  return (
    <div className="grid grid-cols-6 gap-3">
      <StatCard title="Sites" value={s.siteCount} />
      <StatCard title="Devices" value={s.deviceCount} />
      <StatCard title="Online" value={s.onlineDeviceCount} status={s.onlineDeviceCount > 0 ? "normal" : "unknown"} />
      <StatCard title="Stale" value={s.staleDeviceCount} status={s.staleDeviceCount > 0 ? "warning" : "normal"} />
      <StatCard title="Active Alarms" value={s.activeAlarmCount} status={s.activeAlarmCount > 0 ? "warning" : "normal"} />
      <StatCard title="Critical / Major" value={s.criticalAlarmCount} status={s.criticalAlarmCount > 0 ? "critical" : "normal"} />
    </div>
  );
}

function SitesTable({ rows }: { rows: ReportSiteRow[] }) {
  if (rows.length === 0) return <p className="px-4 py-5 text-xs text-slate-600">No site data available.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-100/90">
            <th className="px-4 py-2.5 font-semibold text-slate-700">Site</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Devices</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Online</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Stale</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Alarms</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Critical</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Health</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.siteKey} className="hover:bg-slate-100">
              <td className="px-4 py-2.5 font-medium text-slate-950">{row.siteName}</td>
              <td className="px-4 py-2.5 text-slate-700">{row.deviceCount}</td>
              <td className="px-4 py-2.5 text-emerald-700">{row.onlineDeviceCount}</td>
              <td className="px-4 py-2.5 text-amber-700">{row.staleDeviceCount}</td>
              <td className="px-4 py-2.5 text-slate-700">{row.activeAlarmCount}</td>
              <td className="px-4 py-2.5 text-red-700">{row.criticalAlarmCount}</td>
              <td className="px-4 py-2.5"><StatusBadge status={row.health} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DevicesTable({ rows, showSiteKey }: { rows: ReportDeviceRow[]; showSiteKey?: boolean }) {
  if (rows.length === 0) return <p className="px-4 py-5 text-xs text-slate-600">No device data available.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-100/90">
            {showSiteKey ? <th className="px-4 py-2.5 font-semibold text-slate-700">Site</th> : null}
            <th className="px-4 py-2.5 font-semibold text-slate-700">Device</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Type</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Health</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Reachable</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Alarms</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Latency</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Loss</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">CPU</th>
            <th className="px-4 py-2.5 font-semibold text-slate-700">Memory</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={row.deviceId} className="hover:bg-slate-100">
              {showSiteKey ? <td className="px-4 py-2.5 font-medium text-slate-700">{row.siteKey}</td> : null}
              <td className="px-4 py-2.5 font-medium text-slate-950">{row.name}</td>
              <td className="px-4 py-2.5 text-slate-700">{row.type}</td>
              <td className="px-4 py-2.5"><StatusBadge status={row.health} /></td>
              <td className="px-4 py-2.5"><StatusBadge status={row.reachable ? "online" : "offline"} /></td>
              <td className="px-4 py-2.5 text-slate-700">{row.alarmCount}</td>
              <td className="px-4 py-2.5 text-slate-700">{row.avgLatencyMs > 0 ? `${row.avgLatencyMs.toFixed(1)} ms` : "--"}</td>
              <td className="px-4 py-2.5 text-slate-700">{row.packetLossPct > 0 ? `${row.packetLossPct.toFixed(1)}%` : "--"}</td>
              <td className="px-4 py-2.5 text-slate-700">{row.cpuAvgPct > 0 ? `${row.cpuAvgPct.toFixed(1)}%` : "--"}</td>
              <td className="px-4 py-2.5 text-slate-700">{row.memoryAvgPct > 0 ? `${row.memoryAvgPct.toFixed(1)}%` : "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "24h";

  const setRange = useCallback(
    (r: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (r === "24h") {
        params.delete("range");
      } else {
        params.set("range", r);
      }
      const qs = params.toString();
      router.replace(`/reports${qs ? `?${qs}` : ""}`);
    },
    [router, searchParams],
  );

  const summaryQuery = useQuery({
    queryKey: ["reports-summary", range],
    queryFn: () => fetchReportSummary(range),
    refetchInterval: 60_000,
  });
  const sitesQuery = useQuery({
    queryKey: ["reports-sites", range],
    queryFn: () => fetchReportSites(range),
    refetchInterval: 60_000,
  });
  const devicesQuery = useQuery({
    queryKey: ["reports-devices", range],
    queryFn: () => fetchReportDevices(range),
    refetchInterval: 60_000,
  });

  const siteRows = sitesQuery.data?.items || [];
  const deviceRows = devicesQuery.data?.items || [];

  const handleExportSitesCSV = () => {
    if (siteRows.length === 0) return;
    const headers = ["Site", "Devices", "Online", "Stale", "Alarms", "Critical", "Health", "Last Updated"];
    const rows = siteRows.map((r) => [r.siteName, String(r.deviceCount), String(r.onlineDeviceCount), String(r.staleDeviceCount), String(r.activeAlarmCount), String(r.criticalAlarmCount), r.health, r.lastUpdatedAt]);
    downloadCSV(`nms-sites-report-${range}.csv`, headers, rows);
  };

  const handleExportDevicesCSV = () => {
    if (deviceRows.length === 0) return;
    const headers = ["Device", "Type", "Site", "Health", "Reachable", "Alarms", "Latency (ms)", "Packet Loss (%)", "CPU (%)", "Memory (%)", "Updated At"];
    const rows = deviceRows.map((r) => [r.name, r.type, r.siteKey, r.health, String(r.reachable), String(r.alarmCount), String(r.avgLatencyMs), String(r.packetLossPct), String(r.cpuAvgPct), String(r.memoryAvgPct), r.updatedAt]);
    downloadCSV(`nms-devices-report-${range}.csv`, headers, rows);
  };

  return (
    <DashboardShell title="Reports" subtitle="Periodic performance, health, and alarm summary.">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Period:</span>
            <div className="flex gap-px">
              {RANGES.map((r) => (
                <button key={r.value} onClick={() => setRange(r.value)} className={`border px-3 py-1.5 text-xs font-medium transition ${range === r.value ? "border-blue-800 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {summaryQuery.data?.generatedAt ? <span className="text-[11px] text-slate-600">Generated {new Date(summaryQuery.data.generatedAt).toLocaleString()}</span> : null}
          </div>
        </div>

        {summaryQuery.error ? <p className="border border-red-200 bg-red-100 px-4 py-3 text-sm text-red-800">{summaryQuery.error.message}</p> : null}
        {summaryQuery.isLoading ? <p className="py-4 text-xs text-slate-600">Loading report data...</p> : null}

        <SummaryStrip data={summaryQuery.data} />

        <div className="border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Sites Report</p>
              <p className="mt-0.5 text-[11px] text-slate-600">Per-site device counts, alarm counts, and health.</p>
            </div>
            {siteRows.length > 0 ? (
              <button onClick={handleExportSitesCSV} className="border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-50">
                Export CSV
              </button>
            ) : null}
          </div>
          <SitesTable rows={siteRows} />
        </div>

        <div className="border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Devices Report</p>
              <p className="mt-0.5 text-[11px] text-slate-600">Per-device health, alarm count, and key metrics.</p>
            </div>
            {deviceRows.length > 0 ? (
              <button onClick={handleExportDevicesCSV} className="border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-50">
                Export CSV
              </button>
            ) : null}
          </div>
          <DevicesTable rows={deviceRows} showSiteKey />
        </div>
      </div>
    </DashboardShell>
  );
}
