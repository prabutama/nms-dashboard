export type HealthResponse = {
  service: string;
  status: string;
  timestamp: string;
  version: string;
  phase: string;
  config: {
    port: string;
    cacheTtlSeconds: number;
    thingsBoardBaseUrlSet: boolean;
    thingsBoardApiKeySet: boolean;
    thingsBoardConfigured: boolean;
    thingsBoardClientEnabled: boolean;
    thingsBoardSiteAssetType: string;
  };
};

export type Site = {
  siteKey: string;
  assetId: string;
  name: string;
  type: string;
};

export type SiteDevice = {
  deviceId: string;
  name: string;
  type: string;
  label?: string;
  relationType: string;
};

export type DeviceDetail = {
  deviceId: string;
  name: string;
  type: string;
  label?: string;
  profile?: string;
};

export type DeviceSummary = DeviceDetail & {
  status: string;
  telemetryCount: number;
  lastTelemetryTs?: number;
  latestTelemetry: TelemetryValue[];
};

export type TelemetryValue = {
  key: string;
  value: string;
  timestamp: number;
};

export type TelemetryPoint = {
  timestamp: number;
  value: number;
  rawValue: string;
  numeric: boolean;
};

export type TelemetrySeries = {
  key: string;
  points: TelemetryPoint[];
  numeric: boolean;
};

export type SitesResponse = {
  items: Site[];
  source?: string;
  message?: string;
};

export type SiteDevicesResponse = {
  siteKey: string;
  items: SiteDevice[];
  source?: string;
  message?: string;
};

export type DeviceDetailResponse = {
  item: DeviceDetail | null;
  source?: string;
  message?: string;
};

export type LatestTelemetryResponse = {
  deviceId: string;
  items: TelemetryValue[];
  source?: string;
  message?: string;
};

export type TelemetryHistoryResponse = {
  deviceId: string;
  series: TelemetrySeries[];
  source?: string;
  message?: string;
};

export type DeviceSummaryResponse = {
  item: DeviceSummary | null;
  source?: string;
  message?: string;
};

export type AttributeValue = {
  key: string;
  value: unknown;
  valueType: string;
  lastUpdateTs: number;
};

export type AttributesResponse = {
  entityType: string;
  entityId: string;
  scopes: Record<string, AttributeValue[]>;
  source?: string;
  message?: string;
};

export type DashboardHealth = {
  status: "normal" | "warning" | "critical" | "unknown" | string;
  reachable: boolean;
  freshness: "fresh" | "stale" | "unknown" | string;
  lastTelemetryAt?: string;
  lastTelemetryAgeSeconds?: number;
};

export type DashboardMetricCard = {
  key: string;
  label: string;
  value: unknown;
  numeric: boolean;
  unit: string;
  group: string;
  subgroup?: string;
  status: "normal" | "warning" | "critical" | "unknown" | string;
  freshness: "fresh" | "stale" | "unknown" | string;
  updatedAt?: string;
  order: number;
  displayOrder: number;
  visualType?: string;
  warn?: number;
  critical?: number;
};

export type DashboardMetricGroup = {
  group: string;
  title: string;
  items: DashboardMetricCard[];
};

export type DashboardInterface = {
  index?: string;
  name: string;
  label: string;
  status?: string;
  adminStatus?: string;
  rxBps?: number;
  txBps?: number;
  linkSpeed?: number;
  rxKey?: string;
  txKey?: string;
  statusKey?: string;
  metrics?: DashboardMetricCard[];
};

export type DashboardStorage = {
  index?: string;
  name: string;
  label: string;
  type?: string;
  usedPct?: number;
  status?: string;
  updatedAt?: string;
  usedPctKey?: string;
  usedKey?: string;
  totalKey?: string;
  metrics?: DashboardMetricCard[];
};

export type DashboardRoute = {
  destination?: string;
  nextHop?: string;
  interfaceId?: string;
  interfaceName?: string;
  protocol?: string;
  routeType?: string;
  isDefault?: boolean;
};

export type DashboardRouting = {
  supported: boolean;
  source?: string;
  collectedAt?: string;
  defaultRoute?: DashboardRoute;
  summary: {
    routeCount?: number;
    defaultRouteCount?: number;
    connectedRouteCount?: number;
    remoteRouteCount?: number;
    changed: boolean;
  };
  routes: DashboardRoute[];
};

export type Alarm = {
  alarmId: string;
  name: string;
  type: string;
  severity: string;
  status: string;
  acknowledged: boolean;
  cleared: boolean;
  originatorId?: string;
  originatorType?: string;
  originatorName?: string;
  originatorLabel?: string;
  originatorDisplayName?: string;
  createdAt?: string;
  startAt?: string;
  endAt?: string;
  ackAt?: string;
  clearAt?: string;
  details?: unknown;
};

export type AlarmListResponse = {
  items: Alarm[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  source?: string;
  message?: string;
};

export type AlarmActionResponse = {
  ok: boolean;
  action: string;
  alarmId: string;
  alarm: Alarm;
  source?: string;
  message?: string;
};

export type SiteTopologyResponse = {
  site: {
    siteKey: string;
    assetId: string;
    name: string;
    type: string;
  };
  topology: SiteTopology;
  source?: string;
  message?: string;
};

export type SiteTopology = {
  supported: boolean;
  source?: string;
  generatedAt?: string;
  fingerprint?: string;
  summary: {
    deviceCount: number;
    nodeCount: number;
    edgeCount: number;
    subnetCount: number;
    externalCount: number;
  };
  nodes: SiteTopologyNode[];
  edges: SiteTopologyEdge[];
};

export type SiteTopologyNode = {
  id: string;
  kind: string;
  name: string;
  label?: string;
  deviceId?: string;
  subnet?: string;
  group?: string;
  status?: string;
  displayType?: string;
  displayRole?: string;
  displayShape?: string;
  layer?: string;
  profile?: string;
  type?: string;
};

export type SiteTopologyEdge = {
  from: string;
  to: string;
  reason: string;
  resolved: boolean;
  label?: string;
};

export type DeviceDashboardResponse = {
  device: DeviceDetail;
  health: DashboardHealth;
  metricCards: DashboardMetricCard[];
  metricGroups: DashboardMetricGroup[];
  interfaces: DashboardInterface[];
  storage: DashboardStorage[];
  routing: DashboardRouting;
  debug: {
    rawTelemetryCount: number;
    rawAttributeCount: number;
  };
  source?: string;
  message?: string;
};

export type ReportRange = {
  label: string;
  startAt: string;
  endAt: string;
};

export type ReportSummaryKPI = {
  siteCount: number;
  deviceCount: number;
  onlineDeviceCount: number;
  staleDeviceCount: number;
  activeAlarmCount: number;
  criticalAlarmCount: number;
};

export type ReportSiteRow = {
  siteKey: string;
  siteName: string;
  deviceCount: number;
  onlineDeviceCount: number;
  staleDeviceCount: number;
  activeAlarmCount: number;
  criticalAlarmCount: number;
  health: string;
  lastUpdatedAt: string;
};

export type ReportDeviceRow = {
  deviceId: string;
  siteKey: string;
  name: string;
  type: string;
  health: string;
  reachable: boolean;
  freshness: string;
  alarmCount: number;
  avgLatencyMs: number;
  packetLossPct: number;
  cpuAvgPct: number;
  memoryAvgPct: number;
  updatedAt: string;
};

export type ReportSummaryResponse = {
  range: ReportRange;
  summary: ReportSummaryKPI;
  topSitesByAlarms: ReportSiteRow[];
  topDevicesByIssues: ReportDeviceRow[];
  generatedAt: string;
  source?: string;
  message?: string;
};

export type ReportSitesResponse = {
  range: ReportRange;
  items: ReportSiteRow[];
  source?: string;
  message?: string;
};

export type ReportDevicesResponse = {
  range: ReportRange;
  items: ReportDeviceRow[];
  source?: string;
  message?: string;
};
