"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { DeviceLink, StatCard, StatusBadge } from "@/components/nms-ui";
import { fetchReportDevices, fetchSiteAlarms, fetchSiteDevices, fetchSites, fetchSiteTopology } from "@/lib/api";

function tsDisplay(ts?: string) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export function SiteDetailDashboard({ siteKey }: { siteKey: string }) {
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 60_000 });
  const devicesQuery = useQuery({ queryKey: ["site-devices", siteKey], queryFn: () => fetchSiteDevices(siteKey), refetchInterval: 60_000 });
  const reportDevicesQuery = useQuery({ queryKey: ["report-devices", "24h", siteKey], queryFn: () => fetchReportDevices("24h", siteKey), refetchInterval: 60_000 });
  const site = sitesQuery.data?.items.find((item) => item.siteKey === siteKey);
  const topologyQuery = useQuery({
    queryKey: ["site-topology", siteKey],
    queryFn: () => fetchSiteTopology(siteKey),
    enabled: sitesQuery.data !== undefined,
    refetchInterval: 60_000,
  });
  const topology = topologyQuery.data?.topology;
  const hasTopology = topology?.supported && topology.nodes.length > 0;

  const alarmsQuery = useQuery({
    queryKey: ["site-alarms", siteKey],
    queryFn: () => fetchSiteAlarms(siteKey, { searchStatus: "ACTIVE" }),
    enabled: sitesQuery.data !== undefined,
    refetchInterval: 30_000,
  });
  const siteAlarms = alarmsQuery.data?.items || [];

  const activeAlarmCount = alarmsQuery.data?.totalElements ?? 0;
  const alarmBadge = activeAlarmCount > 0 ? (siteAlarms.some((a) => a.severity === "CRITICAL" || a.severity === "MAJOR") ? "critical" : "warning") : "normal";

  const deviceHealthByID = new Map((reportDevicesQuery.data?.items || []).map((device) => [device.deviceId, device.health]));

  return (
    <DashboardShell title={site?.name || siteKey} subtitle="Site-level summary, device list, and operational status.">
      <div className="flex text-xs text-slate-600">
        <Link href="/sites" className="text-blue-600 hover:text-blue-700">Sites</Link>
        <span className="mx-2">/</span>
        <span>{site?.name || siteKey}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Devices" value={devicesQuery.data?.items.length || 0} note="Related to site" />
        <StatCard title="Health" value={activeAlarmCount > 0 ? "Alarms" : "Normal"} note={activeAlarmCount > 0 ? `${activeAlarmCount} active` : "No active alarms"} status={alarmBadge} />
        <StatCard title="Active Alarms" value={activeAlarmCount} note="Across site devices" status={alarmBadge} />
        <StatCard title="Access" value="Read Only" note="Public portfolio mode" status="unknown" />
      </div>

      <div className="border border-slate-300 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-slate-800">Devices in Site</p>
            <p className="mt-0.5 text-[11px] text-slate-600">Open device detail for metrics and debug data.</p>
          </div>
          <Link href="/sites" className="border border-slate-400 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-100">Back</Link>
        </div>
        {devicesQuery.isLoading ? <p className="px-4 py-5 text-xs text-slate-600">Loading devices...</p> : null}
        {devicesQuery.error ? <p className="px-4 py-5 text-xs text-red-600">{devicesQuery.error.message}</p> : null}
        {devicesQuery.data?.items.length === 0 ? <p className="border-b border-slate-200 px-4 py-5 text-xs text-slate-600">No devices found for this site.</p> : null}
        {devicesQuery.data?.items.map((device) => (
          <DeviceLink key={device.deviceId} href={`/devices/${device.deviceId}?site=${siteKey}`} name={device.label || device.name} type={device.type} status={deviceHealthByID.get(device.deviceId) || "unknown"} />
        ))}
      </div>

      {hasTopology ? (
        <div className="border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Logical Topology</p>
              <p className="mt-0.5 text-[11px] text-slate-600">IPv4 route and subnet analysis.</p>
            </div>
            <Link href={`/sites/${siteKey}/topology`} className="border border-blue-800 bg-blue-700 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-800">View</Link>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-4">
            <div className="border border-slate-300 bg-slate-100 px-3 py-2"><p className="text-[11px] text-slate-600">Devices</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.deviceCount ?? 0}</p></div>
            <div className="border border-slate-300 bg-slate-100 px-3 py-2"><p className="text-[11px] text-slate-600">Subnets</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.subnetCount ?? 0}</p></div>
            <div className="border border-slate-300 bg-slate-100 px-3 py-2"><p className="text-[11px] text-slate-600">External</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.externalCount ?? 0}</p></div>
            <div className="border border-slate-300 bg-slate-100 px-3 py-2"><p className="text-[11px] text-slate-600">Links</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.edgeCount ?? 0}</p></div>
          </div>
          {topology?.generatedAt ? (
            <p className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-600">Generated: {tsDisplay(topology.generatedAt)}</p>
          ) : null}
        </div>
      ) : null}

      {siteAlarms.length > 0 ? (
        <div className="border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">Recent Alarms</p>
              <p className="mt-0.5 text-[11px] text-slate-600">Latest alarm events for this site.</p>
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
                {siteAlarms.slice(0, 5).map((alarm) => (
                  <tr key={alarm.alarmId}>
                    <td className="px-4 py-2"><StatusBadge status={alarm.severity === "CRITICAL" ? "critical" : "warning"} /></td>
                    <td className="px-4 py-2 font-medium text-slate-950">{alarm.type}</td>
                    <td className="px-4 py-2 text-slate-700">{alarm.originatorLabel || alarm.originatorName || "-"}</td>
                    <td className="px-4 py-2 text-slate-700">{alarm.status}</td>
                    <td className="px-4 py-2 text-slate-700">{tsDisplay(alarm.createdAt)}</td>
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
