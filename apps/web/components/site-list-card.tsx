"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TelemetryChart } from "@/components/telemetry-chart";
import { getApiBaseUrl } from "@/lib/config";
import { formatAge, formatTimestamp, getFreshness } from "@/lib/time";
import type {
  DeviceDetailResponse,
  DeviceDashboardResponse,
  DeviceSummaryResponse,
  AttributesResponse,
  LatestTelemetryResponse,
  SiteDevicesResponse,
  SitesResponse,
  TelemetryHistoryResponse,
} from "@/lib/types";

async function fetchSites(): Promise<SitesResponse> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/sites`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Network error. Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("BFF route missing: GET /api/v1/sites returned 404.");
    }

    throw new Error(`BFF returned status ${response.status} for GET /api/v1/sites.`);
  }

  return response.json();
}

async function fetchSiteDevices(siteKey: string): Promise<SiteDevicesResponse> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/sites/${siteKey}/devices`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Network error. Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Site or BFF route missing for ${siteKey}.`);
    }

    throw new Error(`BFF returned status ${response.status} for site devices.`);
  }

  return response.json();
}

async function fetchDeviceDetail(deviceId: string): Promise<DeviceDetailResponse> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/devices/${deviceId}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Network error. Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Device detail route missing for ${deviceId}.`);
    }

    throw new Error(`BFF returned status ${response.status} for device detail.`);
  }

  return response.json();
}

async function fetchLatestTelemetry(deviceId: string): Promise<LatestTelemetryResponse> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/devices/${deviceId}/telemetry/latest`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Network error. Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Latest telemetry route missing for ${deviceId}.`);
    }

    throw new Error(`BFF returned status ${response.status} for latest telemetry.`);
  }

  return response.json();
}

async function fetchDeviceSummary(deviceId: string): Promise<DeviceSummaryResponse> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/devices/${deviceId}/summary`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Network error. Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Device summary route missing for ${deviceId}.`);
    }

    throw new Error(`BFF returned status ${response.status} for device summary.`);
  }

  return response.json();
}

async function fetchDeviceDashboard(deviceId: string): Promise<DeviceDashboardResponse> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/devices/${deviceId}/dashboard`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Network error. Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Device dashboard route missing for ${deviceId}.`);
    }

    throw new Error(`BFF returned status ${response.status} for device dashboard.`);
  }

  return response.json();
}

async function fetchAttributes(entityType: "assets" | "devices", entityId: string): Promise<AttributesResponse> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/${entityType}/${entityId}/attributes`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Network error. Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (!response.ok) {
    throw new Error(`BFF returned status ${response.status} for ${entityType} attributes.`);
  }

  return response.json();
}

async function fetchTelemetryHistory(deviceId: string): Promise<TelemetryHistoryResponse> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/devices/${deviceId}/telemetry/history`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Network error. Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Telemetry history route missing for ${deviceId}.`);
    }

    throw new Error(`BFF returned status ${response.status} for telemetry history.`);
  }

  return response.json();
}

export function SiteListCard() {
  const [selectedSiteKey, setSelectedSiteKey] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const { data, error, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: fetchSites,
  });
  const {
    data: devicesData,
    error: devicesError,
    isLoading: isDevicesLoading,
  } = useQuery({
    queryKey: ["site-devices", selectedSiteKey],
    queryFn: () => fetchSiteDevices(selectedSiteKey as string),
    enabled: selectedSiteKey !== null,
  });
  const {
    data: deviceDetailData,
    error: deviceDetailError,
    isLoading: isDeviceDetailLoading,
  } = useQuery({
    queryKey: ["device-detail", selectedDeviceId],
    queryFn: () => fetchDeviceDetail(selectedDeviceId as string),
    enabled: selectedDeviceId !== null,
  });
  const {
    data: telemetryData,
    error: telemetryError,
    isLoading: isTelemetryLoading,
  } = useQuery({
    queryKey: ["latest-telemetry", selectedDeviceId],
    queryFn: () => fetchLatestTelemetry(selectedDeviceId as string),
    enabled: selectedDeviceId !== null,
  });
  const {
    data: summaryData,
    error: summaryError,
    isLoading: isSummaryLoading,
  } = useQuery({
    queryKey: ["device-summary", selectedDeviceId],
    queryFn: () => fetchDeviceSummary(selectedDeviceId as string),
    enabled: selectedDeviceId !== null,
  });
  const {
    data: dashboardData,
    error: dashboardError,
    isLoading: isDashboardLoading,
  } = useQuery({
    queryKey: ["device-dashboard", selectedDeviceId],
    queryFn: () => fetchDeviceDashboard(selectedDeviceId as string),
    enabled: selectedDeviceId !== null,
  });
  const {
    data: historyData,
    error: historyError,
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ["telemetry-history", selectedDeviceId],
    queryFn: () => fetchTelemetryHistory(selectedDeviceId as string),
    enabled: selectedDeviceId !== null,
  });

  const selectedSite = data?.items.find((site) => site.siteKey === selectedSiteKey);
  const selectedDevice = devicesData?.items.find((device) => device.deviceId === selectedDeviceId);
  const {
    data: siteAttributesData,
    error: siteAttributesError,
    isLoading: isSiteAttributesLoading,
  } = useQuery({
    queryKey: ["site-attributes", selectedSite?.assetId],
    queryFn: () => fetchAttributes("assets", selectedSite?.assetId as string),
    enabled: selectedSite?.assetId !== undefined,
  });
  const {
    data: deviceAttributesData,
    error: deviceAttributesError,
    isLoading: isDeviceAttributesLoading,
  } = useQuery({
    queryKey: ["device-attributes", selectedDeviceId],
    queryFn: () => fetchAttributes("devices", selectedDeviceId as string),
    enabled: selectedDeviceId !== null,
  });

  const summaryFreshness = getFreshness(summaryData?.item?.lastTelemetryTs);
  const metricLabels = new Map(dashboardData?.metricCards.map((metric) => [metric.key, metric]) || []);

  return (
    <Card className="border-white/10 bg-slate-950/55 text-slate-50">
      <CardHeader>
        <CardTitle>NMS Operations Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 text-sm text-slate-300 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Sites</p>
            <p className="mt-2 text-slate-400">Select site, then device.</p>
          </div>
        {isLoading ? <p>Loading sites...</p> : null}
        {error ? <p className="text-rose-300">{error.message}</p> : null}
        {data && data.items.length === 0 ? <p>{data.message || "No sites returned from BFF."}</p> : null}
        {data && data.items.length > 0 ? (
          <div className="space-y-2">
            {data.items.map((site) => (
              <button
                key={site.assetId}
                type="button"
                onClick={() => {
                  setSelectedSiteKey(site.siteKey);
                  setSelectedDeviceId(null);
                }}
                className={`w-full rounded-xl border p-3 text-left transition hover:border-cyan-300/60 hover:bg-cyan-300/10 ${
                  selectedSiteKey === site.siteKey ? "border-cyan-300/80 bg-cyan-300/10" : "border-white/10 bg-white/5"
                }`}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">{site.type}</p>
                <p className="mt-1 font-semibold text-slate-50">{site.name}</p>
                <p className="mt-1 text-xs text-slate-400">{site.siteKey}</p>
              </button>
            ))}
          </div>
        ) : null}
        {data?.source ? <p className="text-xs text-slate-400">source: {data.source}</p> : null}

        {selectedSiteKey ? (
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-[0.25em] text-purple-200">Devices</p>
            <h3 className="mt-2 font-semibold text-slate-50">{selectedSite?.name || selectedSiteKey}</h3>
            <div className="mt-3 space-y-2">
              {isDevicesLoading ? <p>Loading site devices...</p> : null}
              {devicesError ? <p className="text-rose-300">{devicesError.message}</p> : null}
              {devicesData && devicesData.items.length === 0 ? <p>{devicesData.message || "No devices found for site."}</p> : null}
              {devicesData && devicesData.items.length > 0 ? (
                <div className="space-y-2">
                  {devicesData.items.map((device) => (
                    <button
                      key={device.deviceId}
                      type="button"
                      onClick={() => setSelectedDeviceId(device.deviceId)}
                      className={`w-full rounded-xl border p-3 text-left transition hover:border-purple-300/60 hover:bg-purple-300/10 ${
                        selectedDeviceId === device.deviceId ? "border-purple-300/80 bg-purple-300/10" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <p className="font-semibold text-slate-50">{device.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{device.type} · {device.relationType}</p>
                    </button>
                  ))}
                </div>
              ) : null}
              {devicesData?.source ? <p className="text-xs text-slate-400">source: {devicesData.source}</p> : null}
            </div>
          </div>
        ) : null}
        </aside>

        <main className="min-w-0 space-y-5">
          {!selectedSiteKey ? (
            <EmptyState title="No site selected" message="Choose site from sidebar to load related devices." />
          ) : null}
          {selectedSiteKey && !selectedDeviceId ? (
            <EmptyState title="No device selected" message="Choose device to open operational dashboard." />
          ) : null}
          {selectedDeviceId ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-purple-200">Selected Device</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-50">{dashboardData?.device.label || selectedDevice?.name || selectedDeviceId}</h2>
                    <p className="mt-2 text-slate-400">{selectedSite?.name || selectedSiteKey}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{selectedDeviceId}</p>
                  </div>
                  <StatusPill status={dashboardData?.health.status || "unknown"} />
                </div>
                {isDashboardLoading ? <p className="mt-4">Loading dashboard model...</p> : null}
                {dashboardError ? <p className="mt-4 text-rose-300">{dashboardError.message}</p> : null}
                {dashboardData?.health.freshness === "stale" ? (
                  <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-amber-100">Telemetry stale. Values may not reflect current device state.</p>
                ) : null}
              </section>

              {dashboardData ? (
                <>
                  <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard title="Health" value={dashboardData.health.status} tone={dashboardData.health.status} />
                    <SummaryCard title="Reachable" value={dashboardData.health.reachable ? "yes" : "no"} tone={dashboardData.health.reachable ? "normal" : "critical"} />
                    <SummaryCard title="Freshness" value={dashboardData.health.freshness} tone={dashboardData.health.freshness === "fresh" ? "normal" : dashboardData.health.freshness} />
                    <SummaryCard title="Last telemetry" value={dashboardData.health.lastTelemetryAgeSeconds !== undefined ? `${dashboardData.health.lastTelemetryAgeSeconds}s ago` : "unknown"} tone="unknown" />
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                    <SectionHeading title="Metric Cards" subtitle="Normalized latest telemetry with catalog labels and freshness." />
                    {dashboardData.metricCards.length === 0 ? <p className="mt-4 text-slate-400">No telemetry available for this device.</p> : null}
                    <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {dashboardData.metricCards.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
                    </div>
                  </section>

                  {dashboardData.metricGroups.length > 0 ? (
                    <section className="space-y-4">
                      {dashboardData.metricGroups.map((group) => (
                        <div key={group.group} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                          <SectionHeading title={group.title} subtitle={`${group.items.length} metrics`} />
                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {group.items.map((metric) => <MetricCard key={metric.key} metric={metric} compact />)}
                          </div>
                        </div>
                      ))}
                    </section>
                  ) : null}

                  {dashboardData.interfaces.length > 0 ? (
                    <InventorySection title="Interfaces" items={dashboardData.interfaces.map((item) => `${item.label || item.name}: ${[item.rxKey, item.txKey, item.statusKey].filter(Boolean).join(" / ")}`)} />
                  ) : null}

                  {dashboardData.storage.length > 0 ? (
                    <InventorySection title="Storage" items={dashboardData.storage.map((item) => `${item.label || item.name}: ${[item.usedPctKey, item.usedKey, item.totalKey].filter(Boolean).join(" / ")}`)} />
                  ) : null}
                </>
              ) : null}

              <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <SectionHeading title="Metric Charts" subtitle="Historical numeric telemetry from existing history endpoint." />
                {isHistoryLoading ? <p className="mt-3">Loading telemetry charts...</p> : null}
                {historyError ? <p className="mt-3 text-rose-300">{historyError.message}</p> : null}
                {historyData && historyData.series.length === 0 ? <p className="mt-3">{historyData.message || "No numeric telemetry history available."}</p> : null}
                {historyData && historyData.series.length > 0 ? (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {historyData.series.filter((series) => series.numeric).map((series) => (
                      <TelemetryChart key={series.key} series={series} title={metricLabels.get(series.key)?.label} unit={metricLabels.get(series.key)?.unit} />
                    ))}
                  </div>
                ) : null}
              </section>

              <details className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Advanced / Debug</summary>
                <div className="mt-4 space-y-5">
                  {isDeviceDetailLoading ? <p>Loading device detail...</p> : null}
                  {deviceDetailError ? <p className="text-rose-300">{deviceDetailError.message}</p> : null}
                  {summaryError ? <p className="text-rose-300">{summaryError.message}</p> : null}
                  {isSummaryLoading ? <p>Loading legacy summary...</p> : null}
                  {summaryData?.item ? <p className="text-xs text-slate-400">Legacy summary: {summaryData.item.status} · {summaryFreshness.label}</p> : null}
                  {telemetryError ? <p className="text-rose-300">{telemetryError.message}</p> : null}
                  {isTelemetryLoading ? <p>Loading raw telemetry...</p> : null}
                  <RawTelemetryPanel data={telemetryData} />
                  <AttributePanel title="Site Attributes" data={siteAttributesData} error={siteAttributesError} isLoading={isSiteAttributesLoading} />
                  <AttributePanel title="Device Attributes" data={deviceAttributesData} error={deviceAttributesError} isLoading={isDeviceAttributesLoading} />
                  {deviceDetailData?.source ? <p className="text-xs text-slate-400">device detail source: {deviceDetailData.source}</p> : null}
                </div>
              </details>
            </div>
          ) : null}
        </main>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center">
      <p className="text-lg font-semibold text-slate-50">{title}</p>
      <p className="mt-2 text-slate-400">{message}</p>
    </section>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className={`mt-3 text-2xl font-semibold ${toneTextClass(tone)}`}>{value}</p>
    </div>
  );
}

function MetricCard({ metric, compact = false }: { metric: DeviceDashboardResponse["metricCards"][number]; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-50">{metric.label}</p>
          <p className="mt-1 break-all text-xs text-slate-500">{metric.key}</p>
        </div>
        <StatusPill status={metric.status} />
      </div>
      <div className="mt-4 flex items-end gap-2">
        <p className={`${compact ? "text-2xl" : "text-3xl"} font-semibold text-slate-50`}>{formatMetricValue(metric.value)}</p>
        {metric.unit ? <p className="pb-1 text-sm text-slate-400">{metric.unit}</p> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-slate-400/20 bg-slate-400/10 px-2.5 py-1 text-slate-300">{metric.group}</span>
        <span className={`rounded-full border px-2.5 py-1 ${freshnessClass(metric.freshness)}`}>{metric.freshness}</span>
      </div>
      {metric.updatedAt ? <p className="mt-3 text-xs text-slate-500">updated {metric.updatedAt}</p> : null}
    </div>
  );
}

function InventorySection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <SectionHeading title={title} subtitle="Catalog data from device attributes." />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-slate-300">{item}</div>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusClass(status)}`}>{status}</span>;
}

function RawTelemetryPanel({ data }: { data?: LatestTelemetryResponse }) {
  if (!data) {
    return null;
  }

  return (
    <div className="border-t border-white/10 pt-4">
      <p className="text-xs uppercase tracking-[0.25em] text-purple-200">Raw Latest Telemetry</p>
      {data.items.length === 0 ? <p className="mt-3">{data.message || "No latest telemetry found for device."}</p> : null}
      {data.items.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.items.map((item) => (
            <div key={item.key} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-slate-400">{item.key}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getFreshness(item.timestamp).className}`}>
                  {getFreshness(item.timestamp).label}
                </span>
              </div>
              <p className="mt-1 break-all text-base font-semibold text-slate-50">{item.value}</p>
              <p className="mt-2 text-xs text-slate-500">{formatAge(item.timestamp)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatTimestamp(item.timestamp)}</p>
            </div>
          ))}
        </div>
      ) : null}
      {data.source ? <p className="mt-3 text-xs text-slate-400">source: {data.source}</p> : null}
    </div>
  );
}

function formatMetricValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function statusClass(status: string) {
  switch (status) {
    case "normal":
      return "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
    case "warning":
      return "border-amber-300/30 bg-amber-300/10 text-amber-200";
    case "critical":
      return "border-rose-300/30 bg-rose-300/10 text-rose-200";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}

function freshnessClass(freshness: string) {
  return freshness === "fresh" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : freshness === "stale" ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-slate-500/30 bg-slate-500/10 text-slate-300";
}

function toneTextClass(tone: string) {
  switch (tone) {
    case "normal":
    case "fresh":
      return "text-emerald-300";
    case "warning":
    case "stale":
      return "text-amber-300";
    case "critical":
      return "text-rose-300";
    default:
      return "text-slate-100";
  }
}

function AttributePanel({
  title,
  data,
  error,
  isLoading,
}: {
  title: string;
  data?: AttributesResponse;
  error: Error | null;
  isLoading: boolean;
}) {
  const entries = data ? Object.entries(data.scopes) : [];

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="text-xs uppercase tracking-[0.25em] text-purple-200">{title}</p>
      {isLoading ? <p className="mt-3">Loading attributes...</p> : null}
      {error ? <p className="mt-3 text-rose-300">{error.message}</p> : null}
      {data && entries.length === 0 ? <p className="mt-3">{data.message || "No attributes returned."}</p> : null}
      {entries.length > 0 ? (
        <div className="mt-3 space-y-3">
          {entries.map(([scope, attributes]) => (
            <div key={scope} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{scope}</p>
              {attributes.length === 0 ? <p className="mt-2 text-sm text-slate-500">No attributes in this scope.</p> : null}
              {attributes.length > 0 ? (
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {attributes.map((attribute) => (
                    <div key={`${scope}-${attribute.key}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-50">{attribute.key}</p>
                        <span className="rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[11px] text-slate-300">
                          {attribute.valueType}
                        </span>
                      </div>
                      <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-300">
                        {formatAttributeValue(attribute.value)}
                      </pre>
                      <p className="mt-2 text-xs text-slate-500">{formatAge(attribute.lastUpdateTs)}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {data?.source ? <p className="mt-3 text-xs text-slate-400">source: {data.source}</p> : null}
    </div>
  );
}

function formatAttributeValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}
