"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { MetricCard, StatCard, StatusBadge } from "@/components/nms-ui";
import { TelemetryChart } from "@/components/telemetry-chart";
import { fetchAttributes, fetchDeviceAlarms, fetchDeviceDashboard, fetchLatestTelemetry, fetchTelemetryHistory } from "@/lib/api";
import { formatBitrate, formatMetricValue } from "@/lib/format";
import type { DashboardRoute, DeviceDashboardResponse } from "@/lib/types";

export function DeviceDetailDashboard({ deviceId }: { deviceId: string }) {
  const dashboardQuery = useQuery({ queryKey: ["device-dashboard", deviceId], queryFn: () => fetchDeviceDashboard(deviceId), refetchInterval: 15_000 });
  const dashboard = dashboardQuery.data;
  const visibleCards = pickVisibleMetrics(dashboard);
  const visibleGroups = pickVisibleGroups(dashboard);
  const chartKeys = pickChartKeys(dashboard);
  const historyQuery = useQuery({
    queryKey: ["telemetry-history", deviceId, chartKeys.join(",")],
    queryFn: () => fetchTelemetryHistory(deviceId, chartKeys),
    enabled: chartKeys.length > 0,
    refetchInterval: 30_000,
  });
  const telemetryQuery = useQuery({ queryKey: ["latest-telemetry", deviceId], queryFn: () => fetchLatestTelemetry(deviceId), refetchInterval: 15_000 });
  const attributesQuery = useQuery({ queryKey: ["device-attributes", deviceId], queryFn: () => fetchAttributes("devices", deviceId), refetchInterval: 60_000 });
  const alarmsQuery = useQuery({ queryKey: ["device-alarms", deviceId], queryFn: () => fetchDeviceAlarms(deviceId), refetchInterval: 15000 });
  const metricMeta = new Map(dashboard?.metricCards.map((metric) => [metric.key, metric]) || []);

  return (
    <DashboardShell title={dashboard?.device.label || dashboard?.device.name || "Device Detail"} subtitle="Focused device operations view with normalized metrics and debug data separated.">
      <div className="flex text-xs text-slate-500">
        <Link href="/sites" className="text-blue-600 hover:text-blue-700">Sites</Link>
        <span className="mx-2">/</span>
        <Link href="/devices" className="text-blue-600 hover:text-blue-700">Devices</Link>
        <span className="mx-2">/</span>
        <span className="break-all">{deviceId}</span>
      </div>

      {dashboardQuery.isLoading ? <p className="border border-slate-200 bg-white px-4 py-5 text-xs text-slate-500">Loading device dashboard...</p> : null}
      {dashboardQuery.error ? <p className="border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">{dashboardQuery.error.message}</p> : null}

      {dashboard ? (
        <>
          <div className="border border-slate-200 bg-white">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-slate-950">{dashboard.device.label || dashboard.device.name}</h2>
                  <StatusBadge status={dashboard.health.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>Name: {dashboard.device.name || "--"}</span>
                  <span>Type: {dashboard.device.type || "--"}</span>
                  <span>Profile: {dashboard.device.profile || "--"}</span>
                </div>
              </div>
              <Link href="/devices" className="border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 shrink-0">All devices</Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <StatCard title="Reachability" value={dashboard.health.reachable ? "Online" : "Offline"} note="ICMP or telemetry heuristic" status={dashboard.health.reachable ? "normal" : "critical"} />
            <StatCard title="Health" value={dashboard.health.status} note="Derived from freshness and thresholds" status={dashboard.health.status} />
            <StatCard title="Freshness" value={dashboard.health.freshness} note={dashboard.health.lastTelemetryAt || "No telemetry timestamp"} status={dashboard.health.freshness} />
            <StatCard title="Metrics" value={dashboard.metricCards.length} note="Normalized" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleCards.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
          </div>

          <div className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">Metric Groups</p>
            </div>
            <div className="divide-y divide-slate-100">
              {visibleGroups.map((group) => (
                <div key={group.group} className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-700">{group.title}</p>
                    <span className="text-[11px] text-slate-400">{group.items.length} metrics</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">Telemetry Charts</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Selected operational trends. Raw telemetry in Debug.</p>
            </div>
            {historyQuery.isLoading ? <p className="px-4 py-5 text-xs text-slate-500">Loading charts...</p> : null}
            {historyQuery.error ? <p className="px-4 py-5 text-xs text-red-600">{historyQuery.error.message}</p> : null}
            <div className="grid gap-4 p-4 xl:grid-cols-2">
              {(historyQuery.data?.series || []).filter((series) => series.numeric).map((series) => (
                <TelemetryChart key={series.key} series={series} title={metricMeta.get(series.key)?.label} unit={metricMeta.get(series.key)?.unit} />
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <InterfaceTable items={dashboard.interfaces} />
            <StorageTable items={dashboard.storage} />
          </div>

          <RoutingPanel routing={dashboard.routing} />

          <div className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">Alarms</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Active alarms for this device, polling every 15s.</p>
            </div>
            {alarmsQuery.isLoading ? <p className="px-4 py-5 text-xs text-slate-500">Loading alarms...</p> : null}
            {alarmsQuery.error ? <p className="px-4 py-5 text-xs text-red-600">{alarmsQuery.error.message}</p> : null}
            {alarmsQuery.data ? (
              alarmsQuery.data.items.length === 0 ? (
                <p className="px-4 py-5 text-xs text-slate-500">No active alarms for this device.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-2 font-medium text-slate-500">Type</th>
                        <th className="px-4 py-2 font-medium text-slate-500">Severity</th>
                        <th className="px-4 py-2 font-medium text-slate-500">Status</th>
                        <th className="px-4 py-2 font-medium text-slate-500">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {alarmsQuery.data.items.slice(0, 10).map((alarm) => (
                        <tr key={alarm.alarmId}>
                          <td className="px-4 py-2 font-medium text-slate-950">{alarm.name || alarm.type}</td>
                          <td className="px-4 py-2"><StatusBadge status={alarm.severity === "CRITICAL" ? "critical" : "warning"} /></td>
                          <td className="px-4 py-2 text-slate-600">{alarm.cleared ? "Cleared" : alarm.acknowledged ? "Acknowledged" : "Active"}</td>
                          <td className="px-4 py-2 text-slate-500">{alarm.createdAt ? new Date(alarm.createdAt).toLocaleString() : "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}
          </div>

          <details className="border border-slate-200 bg-white">
            <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">Advanced / Debug</summary>
            <div className="grid gap-4 p-4 xl:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-700">Raw latest telemetry</p>
                <pre className="mt-2 max-h-64 overflow-auto bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(telemetryQuery.data || {}, null, 2)}</pre>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700">Raw device attributes</p>
                <pre className="mt-2 max-h-64 overflow-auto bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(attributesQuery.data || {}, null, 2)}</pre>
              </div>
            </div>
          </details>
        </>
      ) : null}
    </DashboardShell>
  );
}

function pickVisibleMetrics(dashboard?: DeviceDashboardResponse) {
  if (!dashboard) {
    return [];
  }
  const priority = [
    "icmp.reachable",
    "icmp.latency_ms",
    "icmp.packet_loss_pct",
    "snmp.host.cpu.load_pct",
    "snmp.host.memory.used_pct",
    "snmp.host.swap.used_pct",
  ];
  const byKey = new Map(dashboard.metricCards.map((metric) => [metric.key, metric]));
  const selected = priority.map((key) => byKey.get(key)).filter(Boolean) as DeviceDashboardResponse["metricCards"];
  const critical = dashboard.metricCards.filter((metric) => metric.status === "critical" && !selected.some((item) => item.key === metric.key)).slice(0, 2);
  return [...selected, ...critical].slice(0, 8);
}

function pickVisibleGroups(dashboard?: DeviceDashboardResponse) {
  if (!dashboard) {
    return [];
  }
  return dashboard.metricGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(isOperationalMetric).slice(0, group.group === "interfaces" ? 8 : 6),
    }))
    .filter((group) => group.items.length > 0);
}

function pickChartKeys(dashboard?: DeviceDashboardResponse) {
  if (!dashboard) {
    return [];
  }
  const preferred = [
    "icmp.latency_ms",
    "icmp.packet_loss_pct",
    "snmp.host.cpu.load_pct",
    "snmp.host.memory.used_pct",
    "snmp.host.swap.used_pct",
  ];
  const byKey = new Map(dashboard.metricCards.map((metric) => [metric.key, metric]));
  const keys = preferred.filter((key) => byKey.has(key));
  const interfaceThroughput = dashboard.metricCards
    .filter((metric) => metric.group === "interfaces" && ["rx_bps", "tx_bps"].some((suffix) => metric.key.endsWith(suffix)))
    .slice(0, 2)
    .map((metric) => metric.key);
  const storageUsage = dashboard.metricCards
    .filter((metric) => metric.group === "storage" && metric.key.endsWith("used_pct") && Number(metric.value) > 0)
    .slice(0, 2)
    .map((metric) => metric.key);
  return Array.from(new Set([...keys, ...interfaceThroughput, ...storageUsage])).slice(0, 9);
}

function isOperationalMetric(metric: DeviceDashboardResponse["metricCards"][number]) {
  if (metric.group === "availability" || metric.group === "system") {
    return true;
  }
  if (metric.group === "interfaces") {
    return ["rx_bps", "tx_bps", "oper_status", "admin_status", "speed_bps", "in_errors", "out_errors"].some((suffix) => metric.key.endsWith(suffix));
  }
  if (metric.group === "storage") {
    return ["used_pct", "used_bytes", "total_bytes", "free_bytes"].some((suffix) => metric.key.endsWith(suffix)) && Number(metric.value) > 0;
  }
  return metric.status === "critical" || metric.status === "warning";
}

function InterfaceTable({ items }: { items: DeviceDashboardResponse["interfaces"] }) {
  return (
    <div className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold text-slate-700">Interfaces</p>
      </div>
      {items.length === 0 ? <p className="px-4 py-5 text-xs text-slate-500">No interface metadata available.</p> : null}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2 font-medium text-slate-500">Interface</th>
                <th className="px-4 py-2 font-medium text-slate-500">RX</th>
                <th className="px-4 py-2 font-medium text-slate-500">TX</th>
                <th className="px-4 py-2 font-medium text-slate-500">Oper</th>
                <th className="px-4 py-2 font-medium text-slate-500">Admin</th>
                <th className="px-4 py-2 font-medium text-slate-500">Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={`iface-${item.index || item.name}`}>
                  <td className="px-4 py-2 font-medium text-slate-950">{item.name || item.label}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-600">{formatBitrate(item.rxBps || 0)}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-600">{formatBitrate(item.txBps || 0)}</td>
                  <td className="px-4 py-2 text-slate-600">{item.status || "--"}</td>
                  <td className="px-4 py-2 text-slate-600">{item.adminStatus || "--"}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-600">{formatBitrate(item.linkSpeed || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function StorageTable({ items }: { items: DeviceDashboardResponse["storage"] }) {
  return (
    <div className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold text-slate-700">Storage</p>
      </div>
      {items.length === 0 ? <p className="px-4 py-5 text-xs text-slate-500">No storage metadata available.</p> : null}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2 font-medium text-slate-500">Name</th>
                <th className="px-4 py-2 font-medium text-slate-500">Type</th>
                <th className="px-4 py-2 font-medium text-slate-500">Usage</th>
                <th className="px-4 py-2 font-medium text-slate-500">Status</th>
                <th className="px-4 py-2 font-medium text-slate-500">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={`storage-${item.index || item.name}`}>
                  <td className="px-4 py-2 font-medium text-slate-950">{item.name || item.label}</td>
                  <td className="px-4 py-2 text-slate-600">{item.type || "--"}</td>
                  <td className="px-4 py-2 text-slate-600">{item.usedPct !== undefined ? formatMetricValue(item.usedPct, "%") : "--"}</td>
                  <td className="px-4 py-2 text-slate-600">{item.status || "unknown"}</td>
                  <td className="px-4 py-2 text-slate-400">{item.updatedAt || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function RoutingPanel({ routing }: { routing: DeviceDashboardResponse["routing"] }) {
  const hasRoutes = routing.routes.length > 0 || routing.defaultRoute;
  const sortedRoutes = [...routing.routes].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    const aType = routeSortKey(a);
    const bType = routeSortKey(b);
    if (aType !== bType) return aType - bType;
    return (a.destination || "").localeCompare(b.destination || "");
  });
  return (
    <div className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold text-slate-700">Routing</p>
        <p className="mt-0.5 text-[11px] text-slate-500">Source: {routing.source || "--"}</p>
      </div>
      {!hasRoutes ? <p className="px-4 py-5 text-xs text-slate-500">No route metadata available.</p> : null}
      {hasRoutes ? (
        <>
          <div className="grid gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:grid-cols-3 xl:grid-cols-6">
            <InfoCell label="Default Gateway" value={routing.defaultRoute?.nextHop || "--"} />
            <InfoCell label="Default Interface" value={routing.defaultRoute?.interfaceName || routing.defaultRoute?.interfaceId || "--"} />
            <InfoCell label="Routes" value={routing.summary.routeCount ?? routing.routes.length} />
            <InfoCell label="Connected" value={routing.summary.connectedRouteCount ?? 0} />
            <InfoCell label="Remote" value={routing.summary.remoteRouteCount ?? 0} />
            <InfoCell label="Collected" value={routing.collectedAt ? new Date(routing.collectedAt).toLocaleString() : "--"} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 font-medium text-slate-500">Destination</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Next Hop</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Interface</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Protocol</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Type</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRoutes.map((route, index) => (
                  <tr key={`route-${route.destination}-${index}`} className={route.isDefault ? "bg-blue-50/30" : ""}>
                    <td className="px-4 py-2 font-mono text-[11px] font-medium text-slate-950">{route.destination || "--"}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-700">{route.nextHop || "--"}</td>
                    <td className="px-4 py-2 text-slate-600">{route.interfaceName || route.interfaceId || "--"}</td>
                    <td className="px-4 py-2">{route.protocol ? <span className="bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{route.protocol}</span> : "--"}</td>
                    <td className="px-4 py-2">{route.routeType ? <span className="bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{route.routeType}</span> : "--"}</td>
                    <td className="px-4 py-2">{route.isDefault ? <span className="bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">Default</span> : route.routeType === "connected" ? <span className="bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-700">Connected</span> : route.routeType ? <span className="bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">Remote</span> : "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function routeSortKey(route: DashboardRoute) {
  if (route.routeType === "connected") return 1;
  if (route.routeType === "remote") return 2;
  return 3;
}

function InfoCell({ label, value }: { label: string; value: string | number }) {
  return <div><p className="text-[11px] text-slate-500">{label}</p><p className="mt-0.5 text-xs font-semibold text-slate-950">{value}</p></div>;
}

