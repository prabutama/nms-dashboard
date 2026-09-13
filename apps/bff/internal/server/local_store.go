package server

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/isapr/nms-dashboard/apps/bff/internal/config"
	"github.com/isapr/nms-dashboard/apps/bff/internal/nms"
)

type localStore struct {
	db *pgxpool.Pool
}

type ingestRequest struct {
	SiteKey string                `json:"siteKey"`
	AgentID string                `json:"agentId"`
	SentAt  time.Time             `json:"sentAt"`
	Items   []ingestTelemetryItem `json:"items"`
}

type ingestTelemetryItem struct {
	DeviceID    string            `json:"deviceId"`
	Metric      string            `json:"metric"`
	TS          time.Time         `json:"ts"`
	ValueType   string            `json:"valueType"`
	ValueNumber *float64          `json:"valueNumber,omitempty"`
	ValueString *string           `json:"valueString,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
}

type ingestResponse struct {
	OK      bool   `json:"ok"`
	Items   int    `json:"items"`
	Source  string `json:"source"`
	Message string `json:"message"`
}

const localSchemaSQL = `
create table if not exists sites (
  site_key text primary key,
  name text not null,
  type text not null default 'site',
  latitude double precision not null default 0,
  longitude double precision not null default 0,
  region text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists devices (
  device_id text primary key,
  site_key text not null references sites(site_key) on delete cascade,
  name text not null,
  type text not null default 'device',
  label text not null default '',
  profile text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists device_attributes (
  device_id text not null references devices(device_id) on delete cascade,
  key text not null,
  value jsonb not null,
  value_type text not null default 'string',
  last_update_ts bigint not null default 0,
  primary key (device_id, key)
);

create table if not exists telemetry_latest (
  device_id text not null references devices(device_id) on delete cascade,
  metric text not null,
  ts timestamptz not null,
  value_type text not null,
  value_number double precision,
  value_string text,
  tags jsonb not null default '{}'::jsonb,
  primary key (device_id, metric)
);

create table if not exists telemetry_history (
  id bigserial primary key,
  device_id text not null references devices(device_id) on delete cascade,
  metric text not null,
  ts timestamptz not null,
  value_type text not null,
  value_number double precision,
  value_string text,
  tags jsonb not null default '{}'::jsonb
);

create table if not exists alarms (
  alarm_id text primary key,
  device_id text not null references devices(device_id) on delete cascade,
  type text not null,
  severity text not null,
  status text not null,
  created_at timestamptz not null default now(),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  details jsonb not null default '{}'::jsonb
);

create table if not exists agent_ingest_batches (
  id bigserial primary key,
  agent_id text not null,
  site_key text not null,
  item_count int not null,
  sent_at timestamptz,
  received_at timestamptz not null default now()
);

create table if not exists topology_snapshots (
  site_key text primary key references sites(site_key) on delete cascade,
  generated_at timestamptz not null default now(),
  fingerprint text not null default '',
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_devices_site_key on devices(site_key);
create index if not exists idx_telemetry_history_lookup on telemetry_history(device_id, metric, ts desc);
create index if not exists idx_alarms_status_created on alarms(status, severity, created_at desc);
`

func openLocalStore(ctx context.Context, cfg config.Config) (*localStore, error) {
	if cfg.DatabaseURL == "" {
		return nil, nil
	}
	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(ctx); err != nil {
		db.Close()
		return nil, err
	}
	store := &localStore{db: db}
	if err := store.ensureSchema(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return store, nil
}

func (s *localStore) ensureSchema(ctx context.Context) error {
	_, err := s.db.Exec(ctx, localSchemaSQL)
	return err
}

func (s *localStore) IngestTelemetry(ctx context.Context, req ingestRequest) error {
	if req.SiteKey == "" {
		return fmt.Errorf("siteKey is required")
	}
	if req.AgentID == "" {
		req.AgentID = "unknown-agent"
	}
	siteName := firstTagged(req.Items, "site_name", req.SiteKey)
	region := firstTagged(req.Items, "site_region", "")
	lat := parseTaggedFloat(req.Items, "site_latitude")
	lon := parseTaggedFloat(req.Items, "site_longitude")

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `insert into sites(site_key, name, type, latitude, longitude, region, updated_at) values($1,$2,'site',$3,$4,$5,now()) on conflict(site_key) do update set name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude, region=excluded.region, updated_at=now()`, req.SiteKey, siteName, lat, lon, region)
	if err != nil {
		return err
	}

	for _, item := range req.Items {
		if strings.TrimSpace(item.DeviceID) == "" || strings.TrimSpace(item.Metric) == "" {
			continue
		}
		if item.TS.IsZero() {
			item.TS = time.Now().UTC()
		}
		if item.ValueType == "" {
			if item.ValueString != nil {
				item.ValueType = "string"
			} else {
				item.ValueType = "number"
			}
		}
		deviceName := firstNonEmpty(item.Tags["device_name"], item.DeviceID)
		deviceType := firstNonEmpty(item.Tags["device_type"], "device")
		deviceLabel := item.Tags["device_label"]
		deviceProfile := item.Tags["device_profile"]
		_, err = tx.Exec(ctx, `insert into devices(device_id, site_key, name, type, label, profile, updated_at) values($1,$2,$3,$4,$5,$6,now()) on conflict(device_id) do update set site_key=excluded.site_key, name=excluded.name, type=excluded.type, label=excluded.label, profile=excluded.profile, updated_at=now()`, item.DeviceID, req.SiteKey, deviceName, deviceType, deviceLabel, deviceProfile)
		if err != nil {
			return err
		}
		tagsJSON, _ := json.Marshal(item.Tags)
		_, err = tx.Exec(ctx, `insert into telemetry_latest(device_id, metric, ts, value_type, value_number, value_string, tags) values($1,$2,$3,$4,$5,$6,$7) on conflict(device_id, metric) do update set ts=excluded.ts, value_type=excluded.value_type, value_number=excluded.value_number, value_string=excluded.value_string, tags=excluded.tags where telemetry_latest.ts <= excluded.ts`, item.DeviceID, item.Metric, item.TS, item.ValueType, item.ValueNumber, item.ValueString, tagsJSON)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `insert into telemetry_history(device_id, metric, ts, value_type, value_number, value_string, tags) values($1,$2,$3,$4,$5,$6,$7)`, item.DeviceID, item.Metric, item.TS, item.ValueType, item.ValueNumber, item.ValueString, tagsJSON)
		if err != nil {
			return err
		}
		if isTelemetryMetadataKey(item.Metric) && item.ValueString != nil {
			valueJSON, _ := json.Marshal(*item.ValueString)
			_, err = tx.Exec(ctx, `insert into device_attributes(device_id, key, value, value_type, last_update_ts) values($1,$2,$3,'string',$4) on conflict(device_id, key) do update set value=excluded.value, value_type=excluded.value_type, last_update_ts=excluded.last_update_ts`, item.DeviceID, item.Metric, valueJSON, item.TS.UnixMilli())
			if err != nil {
				return err
			}
		}
		if isTopologySnapshotKey(item.Metric) && item.ValueString != nil {
			if err := s.saveTopologySnapshot(ctx, tx, req.SiteKey, item.TS, *item.ValueString); err != nil {
				return err
			}
		}
		if err := s.applyMetricAlarm(ctx, tx, item); err != nil {
			return err
		}
	}

	_, err = tx.Exec(ctx, `insert into agent_ingest_batches(agent_id, site_key, item_count, sent_at) values($1,$2,$3,$4)`, req.AgentID, req.SiteKey, len(req.Items), nullableTime(req.SentAt))
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *localStore) saveTopologySnapshot(ctx context.Context, tx pgx.Tx, siteKey string, ts time.Time, raw string) error {
	var snapshot map[string]any
	if err := json.Unmarshal([]byte(raw), &snapshot); err != nil {
		return nil
	}
	fingerprint := ""
	if value, ok := snapshot["fingerprint"].(string); ok {
		fingerprint = value
	}
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `insert into topology_snapshots(site_key, generated_at, fingerprint, snapshot, updated_at) values($1,$2,$3,$4,$2) on conflict(site_key) do update set generated_at=excluded.generated_at, fingerprint=excluded.fingerprint, snapshot=excluded.snapshot, updated_at=excluded.updated_at where topology_snapshots.generated_at <= excluded.generated_at`, siteKey, ts, fingerprint, payload)
	return err
}

func (s *localStore) TopologySnapshot(ctx context.Context, siteKey string) (map[string]any, error) {
	var raw []byte
	if err := s.db.QueryRow(ctx, `select snapshot from topology_snapshots where site_key=$1`, siteKey).Scan(&raw); err != nil {
		return nil, err
	}
	var snapshot map[string]any
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		return nil, err
	}
	return snapshot, nil
}

func (s *localStore) ListSites(ctx context.Context) ([]nms.Site, error) {
	rows, err := s.db.Query(ctx, `select site_key, name, type, latitude, longitude, region from sites order by name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []nms.Site{}
	for rows.Next() {
		var item nms.Site
		if err := rows.Scan(&item.SiteKey, &item.Name, &item.Type, &item.Latitude, &item.Longitude, &item.Region); err != nil {
			return nil, err
		}
		item.AssetID = item.SiteKey
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *localStore) ListSiteDevices(ctx context.Context, siteKey string) ([]nms.Device, error) {
	rows, err := s.db.Query(ctx, `select device_id, name, type, label from devices where site_key=$1 order by name`, siteKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []nms.Device{}
	for rows.Next() {
		var item nms.Device
		if err := rows.Scan(&item.DeviceID, &item.Name, &item.Type, &item.Label); err != nil {
			return nil, err
		}
		item.RelationType = "Contains"
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *localStore) GetDevice(ctx context.Context, deviceID string) (nms.DeviceDetail, error) {
	var item nms.DeviceDetail
	err := s.db.QueryRow(ctx, `select device_id, name, type, label, profile from devices where device_id=$1`, deviceID).Scan(&item.DeviceID, &item.Name, &item.Type, &item.Label, &item.Profile)
	return item, err
}

func (s *localStore) LatestTelemetry(ctx context.Context, deviceID string) ([]nms.TelemetryValue, error) {
	rows, err := s.db.Query(ctx, `select metric, value_type, value_number, value_string, extract(epoch from ts)::bigint * 1000 from telemetry_latest where device_id=$1 order by metric`, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []nms.TelemetryValue{}
	for rows.Next() {
		var key, valueType string
		var valueNumber *float64
		var valueString *string
		var ts int64
		if err := rows.Scan(&key, &valueType, &valueNumber, &valueString, &ts); err != nil {
			return nil, err
		}
		items = append(items, nms.TelemetryValue{Key: key, Value: telemetryValueString(valueType, valueNumber, valueString), Timestamp: ts})
	}
	return items, rows.Err()
}

func (s *localStore) TelemetryHistory(ctx context.Context, deviceID string, keys []string, startTs, endTs int64, limit int) ([]nms.TelemetrySeries, error) {
	if limit <= 0 {
		limit = 500
	}
	if len(keys) == 0 {
		latest, err := s.LatestTelemetry(ctx, deviceID)
		if err != nil {
			return nil, err
		}
		for _, item := range latest {
			if _, err := strconv.ParseFloat(item.Value, 64); err == nil {
				keys = append(keys, item.Key)
			}
		}
	}
	series := make([]nms.TelemetrySeries, 0, len(keys))
	for _, key := range keys {
		rows, err := s.db.Query(ctx, `select extract(epoch from ts)::bigint * 1000, value_type, value_number, value_string from telemetry_history where device_id=$1 and metric=$2 and extract(epoch from ts)::bigint * 1000 between $3 and $4 order by ts desc limit $5`, deviceID, key, startTs, endTs, limit)
		if err != nil {
			return nil, err
		}
		points := []nms.TelemetryPoint{}
		for rows.Next() {
			var ts int64
			var valueType string
			var valueNumber *float64
			var valueString *string
			if err := rows.Scan(&ts, &valueType, &valueNumber, &valueString); err != nil {
				rows.Close()
				return nil, err
			}
			raw := telemetryValueString(valueType, valueNumber, valueString)
			point := nms.TelemetryPoint{Timestamp: ts, RawValue: raw}
			if valueNumber != nil {
				point.Value = *valueNumber
				point.Numeric = true
			}
			points = append(points, point)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}
		sort.Slice(points, func(i, j int) bool { return points[i].Timestamp < points[j].Timestamp })
		series = append(series, nms.TelemetrySeries{Key: key, Points: points, Numeric: len(points) > 0 && points[0].Numeric})
	}
	return series, nil
}

func (s *localStore) Attributes(ctx context.Context, deviceID string) ([]nms.AttributeValue, error) {
	rows, err := s.db.Query(ctx, `select key, value, value_type, last_update_ts from device_attributes where device_id=$1 order by key`, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []nms.AttributeValue{}
	for rows.Next() {
		var item nms.AttributeValue
		var raw []byte
		if err := rows.Scan(&item.Key, &raw, &item.ValueType, &item.LastUpdateTs); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(raw, &item.Value)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *localStore) ListAlarms(ctx context.Context, deviceID, searchStatus string, page, pageSize int) (nms.AlarmPage, error) {
	if pageSize <= 0 {
		pageSize = 20
	}
	args := []any{}
	where := []string{"1=1"}
	if deviceID != "" {
		args = append(args, deviceID)
		where = append(where, fmt.Sprintf("a.device_id=$%d", len(args)))
	}
	if strings.EqualFold(searchStatus, "ACTIVE") {
		where = append(where, "a.status like 'ACTIVE_%'")
	}
	whereSQL := strings.Join(where, " and ")
	var total int64
	if err := s.db.QueryRow(ctx, `select count(*) from alarms a where `+whereSQL, args...).Scan(&total); err != nil {
		return nms.AlarmPage{}, err
	}
	args = append(args, pageSize, page*pageSize)
	rows, err := s.db.Query(ctx, `select a.alarm_id, a.device_id, d.name, d.label, a.type, a.severity, a.status, a.created_at, a.start_at, a.end_at, a.details from alarms a join devices d on d.device_id=a.device_id where `+whereSQL+` order by a.created_at desc limit $`+strconv.Itoa(len(args)-1)+` offset $`+strconv.Itoa(len(args)), args...)
	if err != nil {
		return nms.AlarmPage{}, err
	}
	defer rows.Close()
	items := []nms.Alarm{}
	for rows.Next() {
		var alarm nms.Alarm
		var createdAt, startAt time.Time
		var endAt *time.Time
		var details []byte
		if err := rows.Scan(&alarm.AlarmID, &alarm.OriginatorID, &alarm.OriginatorName, &alarm.OriginatorLabel, &alarm.Type, &alarm.Severity, &alarm.Status, &createdAt, &startAt, &endAt, &details); err != nil {
			return nms.AlarmPage{}, err
		}
		alarm.Name = alarm.OriginatorName
		alarm.OriginatorType = "DEVICE"
		alarm.OriginatorDisplayName = firstNonEmpty(alarm.OriginatorLabel, alarm.OriginatorName)
		alarm.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		alarm.StartAt = startAt.UTC().Format(time.RFC3339)
		if endAt != nil {
			alarm.EndAt = endAt.UTC().Format(time.RFC3339)
			alarm.Cleared = true
		}
		_ = json.Unmarshal(details, &alarm.Details)
		items = append(items, alarm)
	}
	totalPages := 0
	if pageSize > 0 {
		totalPages = int(total) / pageSize
		if int(total)%pageSize > 0 {
			totalPages++
		}
	}
	return nms.AlarmPage{Items: items, Page: page, PageSize: pageSize, TotalElements: total, TotalPages: totalPages, HasNext: page+1 < totalPages}, rows.Err()
}

func (s *localStore) applyMetricAlarm(ctx context.Context, tx pgx.Tx, item ingestTelemetryItem) error {
	if item.ValueNumber == nil {
		return nil
	}
	metric, severity, active := alarmRule(item.Metric, *item.ValueNumber)
	if metric == "" {
		return nil
	}
	alarmID := item.DeviceID + ":" + metric
	if active {
		details, _ := json.Marshal(map[string]any{"metric": item.Metric, "value": *item.ValueNumber})
		_, err := tx.Exec(ctx, `insert into alarms(alarm_id, device_id, type, severity, status, start_at, details) values($1,$2,$3,$4,'ACTIVE_UNACK',$5,$6) on conflict(alarm_id) do update set severity=excluded.severity, status='ACTIVE_UNACK', end_at=null, details=excluded.details`, alarmID, item.DeviceID, metric, severity, item.TS, details)
		return err
	}
	_, err := tx.Exec(ctx, `update alarms set status='CLEARED_UNACK', end_at=$2 where alarm_id=$1 and status like 'ACTIVE_%'`, alarmID, item.TS)
	return err
}

func alarmRule(key string, value float64) (string, string, bool) {
	switch key {
	case "icmp.reachable":
		return "Device Offline", "CRITICAL", value == 0
	case "icmp.packet_loss_pct":
		if value >= 10 {
			return "Packet Loss", "CRITICAL", true
		}
		return "Packet Loss", "WARNING", value >= 5
	case "snmp.host.cpu.load_pct":
		if value >= 90 {
			return "High CPU", "CRITICAL", true
		}
		return "High CPU", "WARNING", value >= 80
	case "snmp.host.memory.used_pct":
		if value >= 95 {
			return "High Memory", "CRITICAL", true
		}
		return "High Memory", "WARNING", value >= 85
	default:
		return "", "", false
	}
}

func telemetryValueString(valueType string, valueNumber *float64, valueString *string) string {
	if valueType == "string" && valueString != nil {
		return *valueString
	}
	if valueNumber != nil {
		return strconv.FormatFloat(*valueNumber, 'f', -1, 64)
	}
	if valueString != nil {
		return *valueString
	}
	return ""
}

func firstTagged(items []ingestTelemetryItem, key, fallback string) string {
	for _, item := range items {
		if value := strings.TrimSpace(item.Tags[key]); value != "" {
			return value
		}
	}
	return fallback
}

func parseTaggedFloat(items []ingestTelemetryItem, key string) float64 {
	value := firstTagged(items, key, "")
	parsed, _ := strconv.ParseFloat(value, 64)
	return parsed
}

func nullableTime(t time.Time) any {
	if t.IsZero() {
		return nil
	}
	return t
}

func isTopologySnapshotKey(key string) bool {
	return key == "topology.logical.ipv4.snapshot" || key == "route.ipv4.snapshot"
}
