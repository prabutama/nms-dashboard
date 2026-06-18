"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { DeviceLink, StatCard, StatusBadge } from "@/components/nms-ui";
import { fetchAttributes, fetchReportDevices, fetchSiteAlarms, fetchSiteDevices, fetchSites, fetchSiteTopology } from "@/lib/api";

function tsDisplay(ts?: string) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export function SiteDetailDashboard({ siteKey }: { siteKey: string }) {
  const { user } = useAuth();
  const canReadDebug = user?.authority === "TENANT_ADMIN" || user?.authority === "SYS_ADMIN";
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 60_000 });
  const devicesQuery = useQuery({ queryKey: ["site-devices", siteKey], queryFn: () => fetchSiteDevices(siteKey), refetchInterval: 60_000 });
  const reportDevicesQuery = useQuery({ queryKey: ["report-devices", "24h", siteKey], queryFn: () => fetchReportDevices("24h", siteKey), refetchInterval: 60_000 });
  const site = sitesQuery.data?.items.find((item) => item.siteKey === siteKey);
  const attributesQuery = useQuery({
    queryKey: ["site-attributes", site?.assetId],
    queryFn: () => fetchAttributes("assets", site?.assetId as string),
    enabled: site?.assetId !== undefined,
    refetchInterval: 60_000,
  });
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
      <div className="flex text-xs text-slate-500">
        <Link href="/sites" className="text-blue-600 hover:text-blue-700">Sites</Link>
        <span className="mx-2">/</span>
        <span>{site?.name || siteKey}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Devices" value={devicesQuery.data?.items.length || 0} note="Related to site" />
        <StatCard title="Health" value={activeAlarmCount > 0 ? "Alarms" : "Normal"} note={activeAlarmCount > 0 ? `${activeAlarmCount} active` : "No active alarms"} status={alarmBadge} />
        <StatCard title="Active Alarms" value={activeAlarmCount} note="Across site devices" status={alarmBadge} />
        <StatCard title="Attributes" value={attributeCount(attributesQuery.data)} note="Site metadata entries" />
      </div>

      <div className="border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-slate-700">Devices in Site</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Open device detail for metrics and debug data.</p>
          </div>
          <Link href="/sites" className="border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50">Back</Link>
        </div>
        {devicesQuery.isLoading ? <p className="px-4 py-5 text-xs text-slate-500">Loading devices...</p> : null}
        {devicesQuery.error ? <p className="px-4 py-5 text-xs text-red-600">{devicesQuery.error.message}</p> : null}
        {devicesQuery.data?.items.length === 0 ? <p className="border-b border-slate-100 px-4 py-5 text-xs text-slate-500">No devices found for this site.</p> : null}
        {devicesQuery.data?.items.map((device) => (
          <DeviceLink key={device.deviceId} href={`/devices/${device.deviceId}?site=${siteKey}`} name={device.label || device.name} type={device.type} status={deviceHealthByID.get(device.deviceId) || "unknown"} />
        ))}
      </div>

      {hasTopology ? (
        <div className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Logical Topology</p>
              <p className="mt-0.5 text-[11px] text-slate-500">IPv4 route and subnet analysis.</p>
            </div>
            <Link href={`/sites/${siteKey}/topology`} className="bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700">View</Link>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-4">
            <div className="border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">Devices</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.deviceCount ?? 0}</p></div>
            <div className="border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">Subnets</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.subnetCount ?? 0}</p></div>
            <div className="border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">External</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.externalCount ?? 0}</p></div>
            <div className="border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">Links</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.edgeCount ?? 0}</p></div>
          </div>
          {topology?.generatedAt ? (
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Generated: {tsDisplay(topology.generatedAt)}</p>
          ) : null}
        </div>
      ) : null}

      {siteAlarms.length > 0 ? (
        <div className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Recent Alarms</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Latest alarm events for this site.</p>
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
                {siteAlarms.slice(0, 5).map((alarm) => (
                  <tr key={alarm.alarmId}>
                    <td className="px-4 py-2"><StatusBadge status={alarm.severity === "CRITICAL" ? "critical" : "warning"} /></td>
                    <td className="px-4 py-2 font-medium text-slate-950">{alarm.type}</td>
                    <td className="px-4 py-2 text-slate-600">{alarm.originatorLabel || alarm.originatorName || "-"}</td>
                    <td className="px-4 py-2 text-slate-600">{alarm.status}</td>
                    <td className="px-4 py-2 text-slate-600">{tsDisplay(alarm.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {canReadDebug ? (
      <details className="border border-slate-200 bg-white">
        <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">Advanced / Debug: site attributes</summary>
        <pre className="max-h-96 overflow-auto bg-slate-50 px-4 py-4 text-xs text-slate-600">{JSON.stringify(attributesQuery.data || {}, null, 2)}</pre>
      </details>
      ) : null}
    </DashboardShell>
  );
}

function attributeCount(data: Awaited<ReturnType<typeof fetchAttributes>> | undefined) {
  if (!data) {
    return 0;
  }
  return Object.values(data.scopes).reduce((sum, items) => sum + items.length, 0);
}
