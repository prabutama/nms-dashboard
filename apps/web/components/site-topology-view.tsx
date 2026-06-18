"use client";

import Link from "next/link";
import { useRef, useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { fetchSites, fetchSiteTopology } from "@/lib/api";
import type { SiteTopologyEdge, SiteTopologyNode } from "@/lib/types";

type Point = { x: number; y: number };
type Size = { w: number; h: number };

const NODE_W = 140;
const ROUTER_W = 160;
const SUBNET_W = 170;
const SERVER_W = 130;
const NODE_H = 28;

function trimNodeName(name: string, max = 24) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}...`;
}

function classifyNodeMeta(node: SiteTopologyNode): { layer: string; shape: string } {
  if (node.layer === "external") return { layer: "external", shape: "external" };
  if (node.layer === "gateway") return { layer: "router", shape: "router" };
  if (node.kind === "subnet" || node.layer === "network") return { layer: "subnet", shape: "subnet" };
  if (node.kind === "external_gateway") return { layer: "external", shape: "external" };
  return { layer: "server", shape: "server" };
}

function edgeStyle(reason: string, resolved: boolean) {
  if (reason === "next_hop_match") return { stroke: "#cbd5e1", dash: "4 4", width: 1 };
  if (!resolved || reason === "default_route") return { stroke: "#d97706", dash: "5 3", width: 1.5 };
  return { stroke: "#94a3b8", dash: "", width: 1.5 };
}

function groupEdgesBy(edges: SiteTopologyEdge[], key: "from" | "to") {
  const grouped = new Map<string, SiteTopologyEdge[]>();
  for (const edge of edges) {
    const id = edge[key];
    const current = grouped.get(id) || [];
    current.push(edge);
    grouped.set(id, current);
  }
  return grouped;
}

export function SiteTopologyView({ siteKey }: { siteKey: string }) {
  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: fetchSites, refetchInterval: 60_000 });
  const site = sitesQuery.data?.items.find((item) => item.siteKey === siteKey);

  const topologyQuery = useQuery({
    queryKey: ["site-topology", siteKey],
    queryFn: () => fetchSiteTopology(siteKey),
    enabled: sitesQuery.data !== undefined,
    refetchInterval: 60_000,
  });

  const topology = topologyQuery.data?.topology;
  const hasTopology = topology?.supported && topology.nodes.length > 0;
  const siteName = topologyQuery.data?.site?.name || site?.name || siteKey;

  return (
    <DashboardShell title={`${siteName} — Logical Topology`} subtitle="Inferred from IPv4 route and subnet data. Not LLDP/CDP physical cabling.">
      <div className="flex text-xs text-slate-500">
        <Link href="/sites" className="text-blue-600 hover:text-blue-700">Sites</Link>
        <span className="mx-2">/</span>
        <Link href={`/sites/${siteKey}`} className="text-blue-600 hover:text-blue-700">{siteName}</Link>
        <span className="mx-2">/</span>
        <span>Topology</span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="border border-slate-200 bg-white px-4 py-2.5"><p className="text-[11px] text-slate-500">Devices</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.deviceCount ?? "-"}</p></div>
        <div className="border border-slate-200 bg-white px-4 py-2.5"><p className="text-[11px] text-slate-500">Subnets</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.subnetCount ?? "-"}</p></div>
        <div className="border border-slate-200 bg-white px-4 py-2.5"><p className="text-[11px] text-slate-500">Edges</p><p className="text-sm font-semibold text-slate-950">{topology?.summary.edgeCount ?? "-"}</p></div>
        <div className="border border-slate-200 bg-white px-4 py-2.5"><p className="text-[11px] text-slate-500">Generated</p><p className="text-sm font-semibold text-slate-950">{topology?.generatedAt ? new Date(topology.generatedAt).toLocaleString() : "-"}</p></div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="border border-slate-200 bg-white px-4 py-2.5"><p className="text-[11px] text-slate-500">Supported</p><p className="text-sm font-semibold text-slate-950">{topology?.supported ? "yes" : "no"}</p></div>
        <div className="border border-slate-200 bg-white px-4 py-2.5"><p className="text-[11px] text-slate-500">Raw Nodes</p><p className="text-sm font-semibold text-slate-950">{topology?.nodes.length ?? 0}</p></div>
        <div className="border border-slate-200 bg-white px-4 py-2.5"><p className="text-[11px] text-slate-500">Raw Edges</p><p className="text-sm font-semibold text-slate-950">{topology?.edges.length ?? 0}</p></div>
        <div className="border border-slate-200 bg-white px-4 py-2.5"><p className="text-[11px] text-slate-500">Source</p><p className="text-sm font-semibold text-slate-950">{topology?.source || "-"}</p></div>
      </div>

      {!hasTopology ? (
        <div className="border border-slate-200 bg-white px-6 py-10 text-center text-xs text-slate-500">
          No topology data available for this site.
        </div>
      ) : (
        <TopologyCanvas nodes={topology.nodes} edges={topology.edges} />
      )}
    </DashboardShell>
  );
}

function TopologyCanvas({ nodes, edges }: { nodes: SiteTopologyNode[]; edges: SiteTopologyEdge[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offsetStart, setOffsetStart] = useState({ x: 0, y: 0 });

  // Hide gateway devices only. Keep all other device types visible.
  const filteredNodes = nodes.filter((n) => n.kind !== "device" || !n.type || n.type !== "gateway");
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter((e) => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to));

  const classified = filteredNodes.map((n) => ({ ...n, meta: classifyNodeMeta(n) }));
  const edgesByFrom = groupEdgesBy(filteredEdges, "from");
  const edgesByTo = groupEdgesBy(filteredEdges, "to");
  const nodeLayer = new Map(classified.map((n) => [n.id, n.meta.layer]));

  const LAYER = {
    LABEL_X: 24,
    CONTENT_X: 110,
    PAD: 28,
  };

  const layerDefs = [
    { key: "external", label: "EXTERNAL", y: 30 },
    { key: "router", label: "ROUTER", y: 110 },
    { key: "subnet", label: "SUBNET", y: 190 },
    { key: "server", label: "SERVER", y: 270 },
  ];

  const externals = classified.filter((n) => n.meta.layer === "external");
  const routers = classified.filter((n) => n.meta.layer === "router");
  const subnets = classified.filter((n) => n.meta.layer === "subnet");
  const servers = classified.filter((n) => n.meta.layer === "server");

  const contentW = Math.max(
    600,
    externals.length * 170,
    routers.length * 200,
    subnets.length * 190,
    servers.length * 150,
  );
  const centerX = LAYER.CONTENT_X + contentW / 2;

  const SVG_W = LAYER.CONTENT_X + contentW + LAYER.PAD;
  const SVG_H = 340;

  const pos = new Map<string, Point>();

  // Distribute items across a center-aligned row
  function distribute(count: number, spacing: number): number[] {
    const total = Math.max(0, (count - 1) * spacing);
    const start = centerX - total / 2;
    return Array.from({ length: count }, (_, i) => start + i * spacing);
  }

  // --- External layer ---
  const extXs = distribute(externals.length, 160);
  externals.forEach((n, i) => {
    pos.set(n.id, { x: extXs[i] - NODE_W / 2, y: layerDefs[0].y });
  });

  // --- Router layer ---
  const routerXs = distribute(routers.length, 200);
  routers.forEach((n, i) => {
    pos.set(n.id, { x: routerXs[i] - ROUTER_W / 2, y: layerDefs[1].y });
  });

  // --- Subnet layer ---
  // Group subnets under their parent router
  const subnetParent = new Map<string, string>();
  for (const sn of subnets) {
    const incoming = edgesByTo.get(sn.id) || [];
    const routerEdge = incoming.find((e) => {
      const meta = nodes.find((nd) => nd.id === e.from);
      return meta && classifyNodeMeta(meta).layer === "router";
    });
    subnetParent.set(sn.id, routerEdge?.from || "");
  }
  const subnetByParent = new Map<string, typeof subnets>();
  for (const sn of subnets) {
    const parent = subnetParent.get(sn.id) || "__orphan__";
    const list = subnetByParent.get(parent) || [];
    list.push(sn);
    subnetByParent.set(parent, list);
  }
  const routerCenter = new Map(routers.map((n, i) => [n.id, routerXs[i]]));
  for (const [parentId, items] of subnetByParent) {
    const rCenter = routerCenter.get(parentId) || centerX;
    const xs = distribute(items.length, 190);
    const shift = xs.map((x) => x - centerX + rCenter);
    items.forEach((n, i) => {
      pos.set(n.id, { x: shift[i] - SUBNET_W / 2, y: layerDefs[2].y });
    });
  }

  // --- Server layer ---
  // Group servers under their connected subnet
  const serverParent = new Map<string, string>();
  for (const sv of servers) {
    const outgoing = edgesByFrom.get(sv.id) || [];
    const incoming = edgesByTo.get(sv.id) || [];
    const subnetEdge = outgoing.find((e) => e.reason === "connected_subnet" && e.to.startsWith("subnet:"))
      || incoming.find((e) => e.reason === "connected_subnet" && e.from.startsWith("subnet:"));
    const parentId = subnetEdge?.to?.startsWith("subnet:") ? subnetEdge.to : subnetEdge?.from || "";
    serverParent.set(sv.id, parentId);
  }
  const serverBySubnet = new Map<string, typeof servers>();
  for (const sv of servers) {
    const parent = serverParent.get(sv.id) || "__orphan__";
    const list = serverBySubnet.get(parent) || [];
    list.push(sv);
    serverBySubnet.set(parent, list);
  }
  const subnetCenterX = new Map<string, number>();
  for (const sn of subnets) {
    const p = pos.get(sn.id);
    if (p) subnetCenterX.set(sn.id, p.x + SUBNET_W / 2);
  }
  for (const [parentId, items] of serverBySubnet) {
    const sCenter = subnetCenterX.get(parentId) || (subnets.length > 0 ? centerX : centerX);
    const xs = distribute(items.length, 150);
    const shift = xs.map((x) => x - centerX + sCenter);
    items.forEach((n, i) => {
      pos.set(n.id, { x: shift[i] - SERVER_W / 2, y: layerDefs[3].y });
    });
  }

  // Clamp positions
  for (const [id, p] of pos) {
    const layer = nodeLayer.get(id);
    const w = layer === "router" ? ROUTER_W : layer === "subnet" ? SUBNET_W : layer === "server" ? SERVER_W : NODE_W;
    p.x = Math.max(LAYER.CONTENT_X, Math.min(SVG_W - LAYER.PAD - w, p.x));
  }

  // Edge path helpers
  function getAnchor(nodeId: string, side: string): Point {
    const p = pos.get(nodeId);
    const layer = nodeLayer.get(nodeId);
    if (!p) return { x: 0, y: 0 };
    const w = layer === "router" ? ROUTER_W : layer === "subnet" ? SUBNET_W : layer === "server" ? SERVER_W : NODE_W;
    const h = NODE_H;
    switch (side) {
      case "top": return { x: p.x + w / 2, y: p.y };
      case "bottom": return { x: p.x + w / 2, y: p.y + h };
      case "left": return { x: p.x, y: p.y + h / 2 };
      case "right": return { x: p.x + w, y: p.y + h / 2 };
      default: return { x: p.x + w / 2, y: p.y + h / 2 };
    }
  }

  function edgeDir(from: string, to: string): { fromSide: string; toSide: string } {
    const fp = pos.get(from);
    const tp = pos.get(to);
    if (!fp || !tp) return { fromSide: "bottom", toSide: "top" };
    const fw = (nodeLayer.get(from) === "router" ? ROUTER_W : nodeLayer.get(from) === "subnet" ? SUBNET_W : nodeLayer.get(from) === "server" ? SERVER_W : NODE_W);
    const tw = (nodeLayer.get(to) === "router" ? ROUTER_W : nodeLayer.get(to) === "subnet" ? SUBNET_W : nodeLayer.get(to) === "server" ? SERVER_W : NODE_W);
    const fc = { x: fp.x + fw / 2, y: fp.y + NODE_H / 2 };
    const tc = { x: tp.x + tw / 2, y: tp.y + NODE_H / 2 };
    const dx = tc.x - fc.x;
    const dy = tc.y - fc.y;
    if (Math.abs(dy) >= Math.abs(dx)) {
      return { fromSide: dy >= 0 ? "bottom" : "top", toSide: dy >= 0 ? "top" : "bottom" };
    }
    return { fromSide: dx >= 0 ? "right" : "left", toSide: dx >= 0 ? "left" : "right" };
  }

  function buildPath(from: string, to: string): string {
    const sides = edgeDir(from, to);
    const a = getAnchor(from, sides.fromSide);
    const b = getAnchor(to, sides.toSide);
    const dy = Math.abs(b.y - a.y);
    const dx = Math.abs(b.x - a.x);
    if (sides.fromSide === "bottom" || sides.fromSide === "top") {
      const curve = Math.min(dy * 0.4, 24);
      const s = b.y > a.y ? 1 : -1;
      return `M${a.x} ${a.y} C${a.x} ${a.y + s * curve},${b.x} ${b.y - s * curve},${b.x} ${b.y}`;
    }
    const curve = Math.min(dx * 0.4, 24);
    const s = b.x > a.x ? 1 : -1;
    return `M${a.x} ${a.y} C${a.x + s * curve} ${a.y},${b.x - s * curve} ${b.y},${b.x} ${b.y}`;
  }

  // Zoom/fit
  const fitView = useCallback(() => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    if (cw <= 0 || ch <= 0) return;
    const z = Math.min(cw / SVG_W, ch / SVG_H) * 0.92;
    setZoom(z);
    setOffset({ x: (cw - SVG_W * z) / 2, y: (ch - SVG_H * z) / 2 });
  }, [SVG_W, SVG_H]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => fitView());
    return () => cancelAnimationFrame(raf);
  }, [fitView]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => fitView());
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [fitView]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const nz = Math.max(0.2, Math.min(10, zoom * factor));
      if (nz === zoom) return;
      setZoom(nz);
      setOffset({ x: mx - (mx - offset.x) / zoom * nz, y: my - (my - offset.y) / zoom * nz });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, offset]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setOffsetStart(offset);
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({ x: offsetStart.x + e.clientX - dragStart.x, y: offsetStart.y + e.clientY - dragStart.y });
  }, [isDragging, dragStart, offsetStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Edges to render (skip next_hop_match in main canvas)
  const displayedEdges = filteredEdges.filter((e) => e.reason !== "next_hop_match");

  // Subnet icon SVG path (simple node-like)
  const subnetIcon = "M2 6h12M2 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2M2 6v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6M6 12v4M14 12v4";

  const minimapScale = 0.11;
  const minimapW = SVG_W * minimapScale;
  const minimapH = SVG_H * minimapScale;
  const viewportX = -offset.x / zoom * minimapScale;
  const viewportY = -offset.y / zoom * minimapScale;
  const viewportW = (containerRef.current?.clientWidth ?? 0) / zoom * minimapScale;
  const viewportH = (containerRef.current?.clientHeight ?? 0) / zoom * minimapScale;

  return (
    <div className="border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-1.5">
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 border border-blue-400 bg-blue-50" />Router</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 border border-slate-300 bg-white" />Server</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-5 border border-slate-400 bg-white" />Subnet</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 border border-dashed border-slate-400 bg-slate-50" />External</span>
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-px w-4 bg-slate-400" />Connected</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-px w-4 border-t border-dashed border-amber-600" />Default</span>
        </div>
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] text-slate-400 mr-1">{Math.round(zoom * 100)}%</span>
          <button onClick={() => { const nz = Math.min(10, zoom * 1.3); setZoom(nz); setOffset({ x: (containerRef.current?.clientWidth ?? 0) / 2 - (containerRef.current?.clientWidth ?? 0) / 2 / zoom * nz, y: (containerRef.current?.clientHeight ?? 0) / 2 - (containerRef.current?.clientHeight ?? 0) / 2 / zoom * nz }); }} className="h-6 w-6 text-xs font-medium text-slate-500 hover:bg-blue-50 hover:text-blue-700" title="Zoom in">+</button>
          <button onClick={() => { const nz = Math.max(0.2, zoom / 1.3); setZoom(nz); setOffset({ x: (containerRef.current?.clientWidth ?? 0) / 2 - (containerRef.current?.clientWidth ?? 0) / 2 / zoom * nz, y: (containerRef.current?.clientHeight ?? 0) / 2 - (containerRef.current?.clientHeight ?? 0) / 2 / zoom * nz }); }} className="h-6 w-6 text-xs font-medium text-slate-500 hover:bg-blue-50 hover:text-blue-700" title="Zoom out">−</button>
          <button onClick={fitView} className="h-6 w-6 text-xs font-medium text-slate-500 hover:bg-blue-50 hover:text-blue-700" title="Fit view">⊡</button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[360px] w-full overflow-hidden bg-white"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <svg
          width={SVG_W}
          height={SVG_H}
          className="absolute"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        >
          {/* Layer separator lines */}
          {layerDefs.map((l, i) => (
            <line key={l.key} x1={LAYER.CONTENT_X - 8} y1={l.y + NODE_H + 6} x2={SVG_W - LAYER.PAD} y2={l.y + NODE_H + 6} stroke="#e2e8f0" strokeWidth="1" />
          ))}
          {/* Layer labels */}
          {layerDefs.map((l) => (
            <text key={l.key} x={LAYER.LABEL_X} y={l.y + NODE_H / 2 + 1} textAnchor="start" fill="#94a3b8" fontSize={10} fontWeight={700} letterSpacing="0.04em">
              {l.label}
            </text>
          ))}

          {/* Edges */}
          {displayedEdges.map((edge, i) => {
            const from = pos.get(edge.from);
            const to = pos.get(edge.to);
            if (!from || !to) return null;
            const d = buildPath(edge.from, edge.to);
            const s = edgeStyle(edge.reason, edge.resolved);
            return (
              <path key={`e${i}`} d={d} fill="none" stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash || "none"} />
            );
          })}

          {/* External nodes */}
          {externals.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            return (
              <g key={n.id}>
                <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={0} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 2" />
                {/* Globe icon */}
                <circle cx={p.x + 16} cy={p.y + NODE_H / 2} r={7} fill="none" stroke="#94a3b8" strokeWidth={1} />
                <ellipse cx={p.x + 16} cy={p.y + NODE_H / 2} rx={3} ry={7} fill="none" stroke="#94a3b8" strokeWidth={0.8} />
                <line x1={p.x + 9} y1={p.y + NODE_H / 2} x2={p.x + 23} y2={p.y + NODE_H / 2} stroke="#94a3b8" strokeWidth={0.8} />
                <text x={p.x + 28} y={p.y + NODE_H / 2 + 1} textAnchor="start" fill="#64748b" fontSize={9} fontWeight={500}>{trimNodeName(n.name, 16)}</text>
              </g>
            );
          })}

          {/* Router nodes */}
          {routers.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            return (
              <g key={n.id}>
                <rect x={p.x} y={p.y} width={ROUTER_W} height={NODE_H} rx={0} fill="#eff6ff" stroke="#93c5fd" strokeWidth={1.5} />
                <text x={p.x + ROUTER_W / 2} y={p.y + NODE_H / 2 + 1} textAnchor="middle" fill="#1e40af" fontSize={11} fontWeight={600}>{trimNodeName(n.name)}</text>
              </g>
            );
          })}

          {/* Subnet nodes */}
          {subnets.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            return (
              <g key={n.id}>
                <rect x={p.x} y={p.y} width={SUBNET_W} height={NODE_H} rx={0} fill="#fafafa" stroke="#cbd5e1" strokeWidth={1} />
                <text x={p.x + 10} y={p.y + NODE_H / 2 + 1} textAnchor="start" fill="#334155" fontSize={9} fontWeight={500}>{trimNodeName(n.name, 24)}</text>
              </g>
            );
          })}

          {/* Server nodes */}
          {servers.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            return (
              <g key={n.id}>
                <rect x={p.x} y={p.y} width={SERVER_W} height={NODE_H} rx={0} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1} />
                {/* Server icon */}
                <rect x={p.x + 8} y={p.y + 7} width={12} height={14} rx={1} fill="none" stroke="#94a3b8" strokeWidth={1} />
                <line x1={p.x + 10} y1={p.y + 10} x2={p.x + 18} y2={p.y + 10} stroke="#94a3b8" strokeWidth={0.8} />
                <line x1={p.x + 10} y1={p.y + 14} x2={p.x + 18} y2={p.y + 14} stroke="#94a3b8" strokeWidth={0.8} />
                <line x1={p.x + 10} y1={p.y + 18} x2={p.x + 18} y2={p.y + 18} stroke="#94a3b8" strokeWidth={0.8} />
                <text x={p.x + 26} y={p.y + NODE_H / 2 + 1} textAnchor="start" fill="#1e293b" fontSize={9} fontWeight={500}>{trimNodeName(n.name)}</text>
              </g>
            );
          })}
        </svg>

        {filteredNodes.length > 10 ? (
          <div className="absolute bottom-3 right-3 rounded-sm border border-slate-200 bg-white p-1 opacity-80">
            <svg width={minimapW} height={minimapH} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="block">
              {displayedEdges.map((edge, i) => {
                const from = pos.get(edge.from);
                const to = pos.get(edge.to);
                if (!from || !to) return null;
                const d = buildPath(edge.from, edge.to);
                const s = edgeStyle(edge.reason, edge.resolved);
                return <path key={`me${i}`} d={d} fill="none" stroke={s.stroke} strokeWidth={0.6} strokeDasharray={s.dash || "none"} />;
              })}
              {filteredNodes.map((n) => {
                const p = pos.get(n.id);
                if (!p) return null;
                const layer = nodeLayer.get(n.id);
                const w = layer === "router" ? ROUTER_W : layer === "subnet" ? SUBNET_W : layer === "server" ? SERVER_W : NODE_W;
                return <rect key={`mn${n.id}`} x={p.x} y={p.y + NODE_H * 0.25} width={w} height={Math.max(6, NODE_H * 0.4)} fill="#cbd5e1" />;
              })}
              <rect x={Math.max(0, viewportX)} y={Math.max(0, viewportY)} width={Math.min(minimapW - 2, viewportW)} height={Math.min(minimapH - 2, viewportH)} fill="none" stroke="#3b82f6" strokeWidth={1.5} />
            </svg>
          </div>
        ) : null}
      </div>

      <details className="border-t border-slate-200">
        <summary className="cursor-pointer bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Raw edges table</summary>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2">To</th>
                <th className="px-4 py-2">Relationship</th>
                <th className="px-4 py-2">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {edges.map((edge, i) => (
                <tr key={`edge-${i}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-slate-950">{edge.from}</td>
                  <td className="px-4 py-2 font-mono text-slate-950">{edge.to}</td>
                  <td className="px-4 py-2 text-slate-600">{edge.label || edge.reason}</td>
                  <td className="px-4 py-2">{edge.resolved
                    ? <span className="inline-flex bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">resolved</span>
                    : <span className="inline-flex bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">unresolved</span>
                  }</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
