package nms

type Site struct {
	SiteKey string `json:"siteKey"`
	AssetID string `json:"assetId"`
	Name    string `json:"name"`
	Type    string `json:"type"`
}

type Device struct {
	DeviceID     string `json:"deviceId"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	Label        string `json:"label,omitempty"`
	RelationType string `json:"relationType"`
}

type DeviceDetail struct {
	DeviceID string `json:"deviceId"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Label    string `json:"label,omitempty"`
	Profile  string `json:"profile,omitempty"`
}

type TelemetryValue struct {
	Key       string `json:"key"`
	Value     string `json:"value"`
	Timestamp int64  `json:"timestamp"`
}

type TelemetryPoint struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value"`
	RawValue  string  `json:"rawValue"`
	Numeric   bool    `json:"numeric"`
}

type TelemetrySeries struct {
	Key     string           `json:"key"`
	Points  []TelemetryPoint `json:"points"`
	Numeric bool             `json:"numeric"`
}

type DeviceSummary struct {
	DeviceID        string           `json:"deviceId"`
	Name            string           `json:"name"`
	Type            string           `json:"type"`
	Label           string           `json:"label,omitempty"`
	Profile         string           `json:"profile,omitempty"`
	Status          string           `json:"status"`
	TelemetryCount  int              `json:"telemetryCount"`
	LastTelemetryTs int64            `json:"lastTelemetryTs,omitempty"`
	LatestTelemetry []TelemetryValue `json:"latestTelemetry"`
}

type AttributeValue struct {
	Key          string `json:"key"`
	Value        any    `json:"value"`
	ValueType    string `json:"valueType"`
	LastUpdateTs int64  `json:"lastUpdateTs"`
}

type DashboardDevice struct {
	DeviceID string `json:"deviceId"`
	Name     string `json:"name"`
	Label    string `json:"label"`
	Type     string `json:"type"`
	Profile  string `json:"profile,omitempty"`
}

type DashboardHealth struct {
	Status                  string `json:"status"`
	Reachable               bool   `json:"reachable"`
	Freshness               string `json:"freshness"`
	LastTelemetryAt         string `json:"lastTelemetryAt,omitempty"`
	LastTelemetryAgeSeconds int64  `json:"lastTelemetryAgeSeconds,omitempty"`
}

type DashboardMetricCard struct {
	Key          string  `json:"key"`
	Label        string  `json:"label"`
	Value        any     `json:"value"`
	Numeric      bool    `json:"numeric"`
	Unit         string  `json:"unit"`
	Group        string  `json:"group"`
	Subgroup     string  `json:"subgroup,omitempty"`
	Status       string  `json:"status"`
	Freshness    string  `json:"freshness"`
	UpdatedAt    string  `json:"updatedAt,omitempty"`
	Order        int     `json:"order"`
	DisplayOrder int     `json:"displayOrder"`
	VisualType   string  `json:"visualType,omitempty"`
	Warn         float64 `json:"warn,omitempty"`
	Critical     float64 `json:"critical,omitempty"`
}

type DashboardMetricGroup struct {
	Group string                `json:"group"`
	Title string                `json:"title"`
	Items []DashboardMetricCard `json:"items"`
}

type DashboardInterface struct {
	Index       string                `json:"index,omitempty"`
	Name        string                `json:"name"`
	Label       string                `json:"label"`
	Status      string                `json:"status,omitempty"`
	AdminStatus string                `json:"adminStatus,omitempty"`
	RxBps       float64               `json:"rxBps,omitempty"`
	TxBps       float64               `json:"txBps,omitempty"`
	LinkSpeed   float64               `json:"linkSpeed,omitempty"`
	RxKey       string                `json:"rxKey,omitempty"`
	TxKey       string                `json:"txKey,omitempty"`
	StatusKey   string                `json:"statusKey,omitempty"`
	Metrics     []DashboardMetricCard `json:"metrics,omitempty"`
}

type DashboardStorage struct {
	Index      string                `json:"index,omitempty"`
	Name       string                `json:"name"`
	Label      string                `json:"label"`
	Type       string                `json:"type,omitempty"`
	UsedPct    float64               `json:"usedPct,omitempty"`
	Status     string                `json:"status,omitempty"`
	UpdatedAt  string                `json:"updatedAt,omitempty"`
	UsedPctKey string                `json:"usedPctKey,omitempty"`
	UsedKey    string                `json:"usedKey,omitempty"`
	TotalKey   string                `json:"totalKey,omitempty"`
	Metrics    []DashboardMetricCard `json:"metrics,omitempty"`
}

type DashboardRouting struct {
	Supported    bool                  `json:"supported"`
	Source       string                `json:"source,omitempty"`
	CollectedAt  string                `json:"collectedAt,omitempty"`
	DefaultRoute *DashboardRoute       `json:"defaultRoute,omitempty"`
	Summary      DashboardRouteSummary `json:"summary"`
	Routes       []DashboardRoute      `json:"routes"`
}

type DashboardRouteSummary struct {
	RouteCount          int  `json:"routeCount,omitempty"`
	DefaultRouteCount   int  `json:"defaultRouteCount,omitempty"`
	ConnectedRouteCount int  `json:"connectedRouteCount,omitempty"`
	RemoteRouteCount    int  `json:"remoteRouteCount,omitempty"`
	Changed             bool `json:"changed"`
}

type DashboardRoute struct {
	Destination   string `json:"destination,omitempty"`
	NextHop       string `json:"nextHop,omitempty"`
	InterfaceID   string `json:"interfaceId,omitempty"`
	InterfaceName string `json:"interfaceName,omitempty"`
	Protocol      string `json:"protocol,omitempty"`
	RouteType     string `json:"routeType,omitempty"`
	IsDefault     bool   `json:"isDefault,omitempty"`
}

type DashboardDebug struct {
	RawTelemetryCount int `json:"rawTelemetryCount"`
	RawAttributeCount int `json:"rawAttributeCount"`
}

type Alarm struct {
	AlarmID               string `json:"alarmId"`
	Name                  string `json:"name"`
	Type                  string `json:"type"`
	Severity              string `json:"severity"`
	Status                string `json:"status"`
	Acknowledged          bool   `json:"acknowledged"`
	Cleared               bool   `json:"cleared"`
	OriginatorID          string `json:"originatorId,omitempty"`
	OriginatorType        string `json:"originatorType,omitempty"`
	OriginatorName        string `json:"originatorName,omitempty"`
	OriginatorLabel       string `json:"originatorLabel,omitempty"`
	OriginatorDisplayName string `json:"originatorDisplayName,omitempty"`
	CreatedAt             string `json:"createdAt,omitempty"`
	StartAt               string `json:"startAt,omitempty"`
	EndAt                 string `json:"endAt,omitempty"`
	AckAt                 string `json:"ackAt,omitempty"`
	ClearAt               string `json:"clearAt,omitempty"`
	Details               any    `json:"details,omitempty"`
}

type AlarmPage struct {
	Items         []Alarm `json:"items"`
	Page          int     `json:"page"`
	PageSize      int     `json:"pageSize"`
	TotalElements int64   `json:"totalElements"`
	TotalPages    int     `json:"totalPages"`
	HasNext       bool    `json:"hasNext"`
}

type DeviceDashboard struct {
	Device       DashboardDevice        `json:"device"`
	Health       DashboardHealth        `json:"health"`
	MetricCards  []DashboardMetricCard  `json:"metricCards"`
	MetricGroups []DashboardMetricGroup `json:"metricGroups"`
	Interfaces   []DashboardInterface   `json:"interfaces"`
	Storage      []DashboardStorage     `json:"storage"`
	Routing      DashboardRouting       `json:"routing"`
	Debug        DashboardDebug         `json:"debug"`
}

type SiteTopologyResponse struct {
	Site     SiteTopologySiteInfo `json:"site"`
	Topology SiteTopology         `json:"topology"`
	Source   string               `json:"source,omitempty"`
	Message  string               `json:"message,omitempty"`
}

type SiteTopologySiteInfo struct {
	SiteKey string `json:"siteKey"`
	AssetID string `json:"assetId"`
	Name    string `json:"name"`
	Type    string `json:"type"`
}

type SiteTopology struct {
	Supported   bool                `json:"supported"`
	Source      string              `json:"source,omitempty"`
	GeneratedAt string              `json:"generatedAt,omitempty"`
	Fingerprint string              `json:"fingerprint,omitempty"`
	Summary     SiteTopologySummary `json:"summary"`
	Nodes       []SiteTopologyNode  `json:"nodes"`
	Edges       []SiteTopologyEdge  `json:"edges"`
}

type SiteTopologySummary struct {
	DeviceCount   int `json:"deviceCount"`
	NodeCount     int `json:"nodeCount"`
	EdgeCount     int `json:"edgeCount"`
	SubnetCount   int `json:"subnetCount"`
	ExternalCount int `json:"externalCount"`
}

type SiteTopologyNode struct {
	ID           string `json:"id"`
	Kind         string `json:"kind"`
	Name         string `json:"name"`
	Label        string `json:"label,omitempty"`
	DeviceID     string `json:"deviceId,omitempty"`
	Subnet       string `json:"subnet,omitempty"`
	Group        string `json:"group,omitempty"`
	Status       string `json:"status,omitempty"`
	DisplayType  string `json:"displayType,omitempty"`
	DisplayRole  string `json:"displayRole,omitempty"`
	DisplayShape string `json:"displayShape,omitempty"`
	Layer        string `json:"layer,omitempty"`
	Profile      string `json:"profile,omitempty"`
	Type         string `json:"type,omitempty"`
}

type SiteTopologyEdge struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Reason   string `json:"reason"`
	Resolved bool   `json:"resolved"`
	Label    string `json:"label,omitempty"`
}

type ReportRange struct {
	Label   string `json:"label"`
	StartAt string `json:"startAt"`
	EndAt   string `json:"endAt"`
}

type ReportSummaryKPI struct {
	SiteCount          int `json:"siteCount"`
	DeviceCount        int `json:"deviceCount"`
	OnlineDeviceCount  int `json:"onlineDeviceCount"`
	StaleDeviceCount   int `json:"staleDeviceCount"`
	ActiveAlarmCount   int `json:"activeAlarmCount"`
	CriticalAlarmCount int `json:"criticalAlarmCount"`
}

type ReportSiteRow struct {
	SiteKey            string `json:"siteKey"`
	SiteName           string `json:"siteName"`
	DeviceCount        int    `json:"deviceCount"`
	OnlineDeviceCount  int    `json:"onlineDeviceCount"`
	StaleDeviceCount   int    `json:"staleDeviceCount"`
	ActiveAlarmCount   int    `json:"activeAlarmCount"`
	CriticalAlarmCount int    `json:"criticalAlarmCount"`
	Health             string `json:"health"`
	LastUpdatedAt      string `json:"lastUpdatedAt"`
}

type ReportDeviceRow struct {
	DeviceID      string  `json:"deviceId"`
	SiteKey       string  `json:"siteKey"`
	Name          string  `json:"name"`
	Type          string  `json:"type"`
	Health        string  `json:"health"`
	Reachable     bool    `json:"reachable"`
	Freshness     string  `json:"freshness"`
	AlarmCount    int     `json:"alarmCount"`
	AvgLatencyMs  float64 `json:"avgLatencyMs"`
	PacketLossPct float64 `json:"packetLossPct"`
	CPUAvgPct     float64 `json:"cpuAvgPct"`
	MemoryAvgPct  float64 `json:"memoryAvgPct"`
	UpdatedAt     string  `json:"updatedAt"`
}
