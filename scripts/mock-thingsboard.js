const http = require("http");
const url = require("url");
const port = 9099;

const snapshotJSON = JSON.stringify({
  site_key: "br-b",
  asset_id: "asset-brb",
  generated_at: new Date().toISOString(),
  device_count: 3,
  edge_count: 7,
  fingerprint: "abb7f7ba953a5ef8171cca6e2c0c616f3687b5bfb2584b6cc791cdb6109062b4",
  nodes: [
    { id: "device:linux-br-b-server", kind: "device", name: "linux-br-b-server", device_id: "linux-br-b-server" },
    { id: "device:linux-br-b-server-2", kind: "device", name: "linux-br-b-server-2", device_id: "linux-br-b-server-2" },
    { id: "device:mikrotik-br-b-router", kind: "device", name: "mikrotik-br-b-router", device_id: "mikrotik-br-b-router" },
    { id: "external:10.10.10.1", kind: "external_gateway", name: "10.10.10.1" },
    { id: "subnet:10.10.10.0/24", kind: "subnet", name: "10.10.10.0/24", subnet: "10.10.10.0/24" },
    { id: "subnet:172.16.30.0/24", kind: "subnet", name: "172.16.30.0/24", subnet: "172.16.30.0/24" },
  ],
  edges: [
    { from: "device:linux-br-b-server", to: "device:linux-br-b-server-2", reason: "next_hop_match", resolved: true },
    { from: "device:linux-br-b-server", to: "subnet:172.16.30.0/24", reason: "connected_subnet", resolved: true },
    { from: "device:linux-br-b-server-2", to: "device:linux-br-b-server", reason: "next_hop_match", resolved: true },
    { from: "device:linux-br-b-server-2", to: "subnet:172.16.30.0/24", reason: "connected_subnet", resolved: true },
    { from: "device:mikrotik-br-b-router", to: "external:10.10.10.1", reason: "default_route", resolved: false },
    { from: "device:mikrotik-br-b-router", to: "subnet:10.10.10.0/24", reason: "connected_subnet", resolved: true },
    { from: "device:mikrotik-br-b-router", to: "subnet:172.16.30.0/24", reason: "connected_subnet", resolved: true },
  ],
});

function apiResponse(data) {
  return JSON.stringify({ data, hasNext: false });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  console.log(`${req.method} ${path}`);

  if (path === "/api/tenant/assets" && req.method === "GET") {
    const type = parsed.query.type || "default";
    return res.end(apiResponse([
      {
        id: { entityType: "ASSET", id: "asset-brb" },
        name: "Branch-B",
        type: type,
        label: "Branch B Site",
      },
    ]));
  }

  if (path === "/api/tenant/devices" && req.method === "GET") {
    return res.end(apiResponse([
      { id: { entityType: "DEVICE", id: "device-mikrotik" }, name: "mikrotik-br-b-router", type: "router" },
    ]));
  }

  const attrMatch = path.match(/^\/api\/plugins\/telemetry\/(ASSET|DEVICE)\/([^/]+)\/values\/attributes/);
  if (attrMatch && req.method === "GET") {
    const entityId = attrMatch[2];
    if (entityId === "asset-brb") {
      const isServerScope = path.includes("SERVER_SCOPE");
      if (isServerScope) {
        return res.end(JSON.stringify([
          {
            key: "topology.logical.ipv4.snapshot",
            value: snapshotJSON,
            lastUpdateTs: Date.now(),
          },
        ]));
      } else {
        return res.end(JSON.stringify([
          { key: "siteKey", value: "br-b", lastUpdateTs: Date.now() },
        ]));
      }
    }
    return res.end(JSON.stringify([]));
  }

  const relMatch = path.match(/^\/api\/(asset|device)\/([^/]+)\/relations/);
  if (relMatch && req.method === "GET") {
    return res.end(apiResponse([]));
  }

  console.log(`  -> 404 (no mock for ${path})`);
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not mocked" }));
});

server.listen(port, () => {
  console.log(`Mock ThingsBoard running on http://localhost:${port}`);
});
