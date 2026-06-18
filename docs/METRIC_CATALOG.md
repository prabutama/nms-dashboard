# Metric Catalog

Dashboard rendering should use ThingsBoard attributes for meaning and telemetry for values.

Device Client Attributes are the primary metadata source for interface, storage, and routing enrichment.

Phase 3A adds a small BFF default catalog. Dashboard metadata precedence:

1. Device `nmsMetrics` attribute.
2. Built-in BFF metric catalog.
3. Pattern fallback for interfaces/storage.
4. Generated fallback label, empty unit, `group: "other"`, `status: "unknown"`.

Indexed interface and storage keys are resolved before generic fallback formatting.

The dashboard endpoint using this catalog is:

```txt
GET /api/v1/devices/{deviceId}/dashboard
```

## Attribute Endpoints

Read site asset attributes:

```txt
GET /api/v1/assets/{assetId}/attributes
```

Read device attributes:

```txt
GET /api/v1/devices/{deviceId}/attributes
```

Optional query params:

* `scope`: `SERVER_SCOPE`, `CLIENT_SCOPE`, or `SHARED_SCOPE`.
* `keys`: comma-separated attribute keys.

Assets support `SERVER_SCOPE`. Devices support `SERVER_SCOPE`, `CLIENT_SCOPE`, and `SHARED_SCOPE`.

## Recommended Attributes

Site asset `SERVER_SCOPE` attribute:

```json
{
  "nmsSite": {
    "siteKey": "headquarter",
    "displayName": "HeadQuarter",
    "region": "Jakarta",
    "priority": "core",
    "timezone": "Asia/Jakarta"
  }
}
```

Device `SERVER_SCOPE` identity attribute:

```json
{
  "nmsIdentity": {
    "role": "gateway",
    "vendor": "MikroTik",
    "model": "CCR2004",
    "os": "RouterOS",
    "location": "Rack A1"
  }
}
```

Device `SERVER_SCOPE` metric catalog attribute:

```json
{
  "nmsMetrics": [
    {
      "key": "cpu_usage",
      "label": "CPU Usage",
      "unit": "%",
      "type": "number",
      "group": "system",
      "chart": "line",
      "warn": 70,
      "critical": 90
    }
  ]
}
```

Device `SERVER_SCOPE` interface catalog attribute:

```json
{
  "nmsInterfaces": [
    {
      "name": "ether1",
      "label": "WAN",
      "rxKey": "ether1_rx_bps",
      "txKey": "ether1_tx_bps",
      "statusKey": "ether1_status"
    }
  ]
}
```

## Rendering Rules

* Numeric telemetry can be charted.
* String, boolean, and JSON telemetry should render as badges or tables.
* Attributes define labels, units, groups, and thresholds.
* If attributes are missing, BFF still returns stable metric cards with fallback metadata.
* Raw telemetry and raw attributes stay available in advanced/debug UI.

## Indexed Interface Metrics

Pattern:

```txt
snmp.if.idx{index}.{metric}
```

Attribute lookup:

```txt
snmp.if.idx{index}.name
snmp.if.idx{index}.alias
snmp.if.idx{index}.description
```

Examples:

* `snmp.if.idx2.rx_bps` + `snmp.if.idx2.name = eth0` -> `eth0 RX Throughput`, `group: interfaces`, `subgroup: eth0`, `unit: bps`.
* `snmp.if.idx2.tx_bps` -> `eth0 TX Throughput`.
* `snmp.if.idx2.oper_status` -> `eth0 Operational Status`.
* `snmp.if.idx2.admin_status` -> `eth0 Admin Status`.
* `snmp.if.idx2.speed_bps` -> `eth0 Link Speed`.
* `snmp.if.idx2.in_errors` -> `eth0 RX Errors`.
* `snmp.if.idx2.out_errors` -> `eth0 TX Errors`.

If no name/alias/description attribute exists, BFF uses `Interface idx{index}`.

Grouped interface tables use short labels such as `RX Throughput`; standalone cards and chart titles use full labels such as `eth0 RX Throughput`.

## Indexed Storage Metrics

Pattern:

```txt
snmp.storage.idx{index}.{metric}
```

Attribute lookup:

```txt
snmp.storage.idx{index}.type
snmp.storage.idx{index}.description
```

Example:

* `snmp.host.storage.idx36.used_pct` + `snmp.host.storage.idx36.description = /` -> `/ Storage Usage`, `group: storage`, `subgroup: /`, `unit: %`.
* `snmp.host.storage.idx54.used_pct` + `snmp.host.storage.idx54.description = /boot/efi` -> `/boot/efi Storage Usage`.
* `snmp.host.storage.idx10.used_pct` + `snmp.host.storage.idx10.description = Swap space` -> `Swap space Usage`.

Storage `type` stays available in the normalized storage table as metadata, but display names use `description`. If description is missing, BFF uses `Storage idx{index}`.

## Routing Attributes

BFF parses route Client Attributes into a normalized routing panel.

Direct defaults:

```txt
route.ipv4.default.destination
route.ipv4.default.interface_id
route.ipv4.default.interface_name
route.ipv4.default.next_hop
route.ipv4.default.protocol
route.ipv4.default.route_type
route.ipv4.source
```

Snapshot:

```txt
route.ipv4.snapshot
```

`route.ipv4.snapshot` may be a JSON string. BFF parses `routes`, route counts, source, collected time, default route, and changed status. If snapshot is missing or invalid, BFF falls back to direct default route attributes.

Raw telemetry keys remain unchanged. Normalized labels are dashboard display metadata only.

## Built-In Catalog

Initial BFF catalog includes:

* `icmp.reachable`: Reachability, availability group.
* `icmp.latency_ms`: Latency, `ms`, availability group.
* `icmp.packet_loss_pct`: Packet Loss, `%`, availability group.
* `icmp.jitter_ms`: Jitter, `ms`, availability group.
* `snmp.host.cpu.load_pct`: CPU Usage, `%`, system group.
* `snmp.host.memory.used_pct`: Memory Used, `%`, system group.
* `snmp.host.swap.used_pct`: Swap Used, `%`, system group.
* keys containing rx/tx and bps: interface throughput, `bps`, interfaces group.
* storage/disk used percent keys: storage usage, `%`, storage group.

Thresholds are intentionally simple. `nmsMetrics` can override `warn` and `critical` per key.
