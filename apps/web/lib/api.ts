import { getApiBaseUrl } from "@/lib/config";
import { getAccessToken, readStoredAuth, writeStoredAuth } from "@/lib/auth";
import type {
  AlarmActionResponse,
  AlarmListResponse,
  AuthResponse,
  AttributesResponse,
  DeviceDashboardResponse,
  LatestTelemetryResponse,
  ReportDevicesResponse,
  ReportSitesResponse,
  ReportSummaryResponse,
  SiteDevicesResponse,
  SitesResponse,
  SiteTopologyResponse,
  TelemetryHistoryResponse,
} from "@/lib/types";

async function getJSON<T>(path: string, retryOnAuth = true): Promise<T> {
  let response: Response;
  const token = getAccessToken();

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (retryOnAuth && response.status === 401) {
    const retried = await tryRefreshAndRetry(() => getJSON<T>(path, false));
    if (retried) {
      return retried;
    }
  }
  if (!response.ok) {
    throw new Error(`BFF returned ${response.status} for ${path}.`);
  }

  return response.json();
}

async function postJSON<T>(path: string, body?: unknown, retryOnAuth = true): Promise<T> {
  let response: Response;
  const token = getAccessToken();

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach BFF at ${getApiBaseUrl()}.`);
  }

  if (retryOnAuth && response.status === 401) {
    const retried = await tryRefreshAndRetry(() => postJSON<T>(path, body, false));
    if (retried) {
      return retried;
    }
  }
  if (!response.ok) {
    throw new Error(`BFF returned ${response.status} for ${path}.`);
  }

  return response.json();
}

async function tryRefreshAndRetry<T>(retry: () => Promise<T>) {
  const stored = readStoredAuth();
  if (!stored?.refreshToken) {
    return null;
  }
  try {
    const refreshed = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });
    if (!refreshed.ok) {
      writeStoredAuth(null);
      return null;
    }
    const payload = await refreshed.json() as AuthResponse;
    writeStoredAuth({
      token: payload.token || "",
      refreshToken: payload.refreshToken || stored.refreshToken,
      user: payload.user,
    });
    return await retry();
  } catch {
    writeStoredAuth(null);
    return null;
  }
}

export function login(username: string, password: string) {
  return postJSON<AuthResponse>("/api/v1/auth/login", { username, password });
}

export function me() {
  return getJSON<AuthResponse>("/api/v1/auth/me");
}

export function logout() {
  return postJSON<{ ok: boolean; message?: string }>("/api/v1/auth/logout");
}

export function fetchAlarms(params?: { searchStatus?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.searchStatus) query.set("searchStatus", params.searchStatus);
  if (params?.page !== undefined) query.set("page", String(params.page));
  if (params?.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return getJSON<AlarmListResponse>(`/api/v1/alarms${qs ? `?${qs}` : ""}`);
}

export function ackAlarm(alarmId: string) {
  return postJSON<AlarmActionResponse>(`/api/v1/alarms/${alarmId}/ack`);
}

export function clearAlarm(alarmId: string) {
  return postJSON<AlarmActionResponse>(`/api/v1/alarms/${alarmId}/clear`);
}

export function fetchSites() {
  return getJSON<SitesResponse>("/api/v1/sites");
}

export function fetchSiteDevices(siteKey: string) {
  return getJSON<SiteDevicesResponse>(`/api/v1/sites/${siteKey}/devices`);
}

export function fetchDeviceDashboard(deviceId: string) {
  return getJSON<DeviceDashboardResponse>(`/api/v1/devices/${deviceId}/dashboard`);
}

export function fetchTelemetryHistory(deviceId: string, options?: { keys?: string[]; startTs?: number; endTs?: number; interval?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (options?.keys && options.keys.length > 0) query.set("keys", options.keys.join(","));
  if (options?.startTs !== undefined) query.set("startTs", String(options.startTs));
  if (options?.endTs !== undefined) query.set("endTs", String(options.endTs));
  if (options?.interval !== undefined) query.set("interval", String(options.interval));
  if (options?.limit !== undefined) query.set("limit", String(options.limit));
  const qs = query.toString();
  const suffix = qs ? `?${qs}` : "";
  return getJSON<TelemetryHistoryResponse>(`/api/v1/devices/${deviceId}/telemetry/history${suffix}`);
}

export function fetchSiteAlarms(siteKey: string, params?: { searchStatus?: string; status?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.searchStatus) query.set("searchStatus", params.searchStatus);
  if (params?.status) query.set("status", params.status);
  if (params?.page !== undefined) query.set("page", String(params.page));
  if (params?.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return getJSON<AlarmListResponse>(`/api/v1/sites/${siteKey}/alarms${qs ? `?${qs}` : ""}`);
}

export function fetchDeviceAlarms(deviceId: string) {
  return getJSON<AlarmListResponse>(`/api/v1/devices/${deviceId}/alarms`);
}

export function fetchSiteTopology(siteKey: string) {
  return getJSON<SiteTopologyResponse>(`/api/v1/sites/${siteKey}/topology`);
}

export function fetchLatestTelemetry(deviceId: string) {
  return getJSON<LatestTelemetryResponse>(`/api/v1/devices/${deviceId}/telemetry/latest`);
}

export function fetchAttributes(entityType: "assets" | "devices", entityId: string) {
  return getJSON<AttributesResponse>(`/api/v1/${entityType}/${entityId}/attributes`);
}

export function fetchReportSummary(range?: string) {
  const qs = range ? `?range=${encodeURIComponent(range)}` : "";
  return getJSON<ReportSummaryResponse>(`/api/v1/reports/summary${qs}`);
}

export function fetchReportSites(range?: string) {
  const qs = range ? `?range=${encodeURIComponent(range)}` : "";
  return getJSON<ReportSitesResponse>(`/api/v1/reports/sites${qs}`);
}

export function fetchReportDevices(range?: string, siteKey?: string) {
  const params = new URLSearchParams();
  if (range) params.set("range", range);
  if (siteKey) params.set("siteKey", siteKey);
  const qs = params.toString();
  return getJSON<ReportDevicesResponse>(`/api/v1/reports/devices${qs ? `?${qs}` : ""}`);
}
