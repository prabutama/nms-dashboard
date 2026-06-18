"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { latLngBounds, type CircleMarker as LeafletCircleMarker, type LatLngBoundsExpression, type Map as LeafletMap } from "leaflet";

export type SiteMapItem = {
  siteKey: string;
  name: string;
  latitude: number;
  longitude: number;
  deviceCount: number;
  onlineDeviceCount: number;
  activeAlarmCount: number;
  health: string;
};

const indonesiaBounds: LatLngBoundsExpression = [
  [-12, 94],
  [8, 142],
];

export function SiteMapPanel({ items, totalSites, missingCoordinateCount }: { items: SiteMapItem[]; totalSites: number; missingCoordinateCount: number }) {
  const [activeSiteKey, setActiveSiteKey] = useState<string | null>(null);
  const [selectedSiteKey, setSelectedSiteKey] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef<Record<string, LeafletCircleMarker | null>>({});
  const sortedItems = useMemo(() => [...items].sort((a, b) => healthRank(a.health) - healthRank(b.health) || a.name.localeCompare(b.name)), [items]);

  const focusSite = (item: SiteMapItem) => {
    setSelectedSiteKey(item.siteKey);
    mapRef.current?.flyTo([item.latitude, item.longitude], Math.max(mapRef.current.getZoom(), 8), { duration: 0.5 });
    markerRefs.current[item.siteKey]?.openPopup();
  };

  return (
    <div className="border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">Site Map</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Branch locations from site latitude and longitude attributes.</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <span>{items.length} / {totalSites} mapped</span>
          <span>{missingCoordinateCount} missing coordinates</span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-xs text-slate-500">No site coordinates available.</div>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Normal</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Warning</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-600" />Critical</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-500" />Unknown</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="overflow-hidden border border-slate-200 bg-slate-50">
              <MapContainer ref={mapRef} bounds={indonesiaBounds} scrollWheelZoom className="h-[360px] w-full" attributionControl={false}>
                <FitMapToSites items={items} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {items.map((item) => {
                  const emphasized = activeSiteKey === item.siteKey || selectedSiteKey === item.siteKey;
                  return (
                    <CircleMarker
                      key={item.siteKey}
                      ref={(marker) => {
                        markerRefs.current[item.siteKey] = marker;
                      }}
                      center={[item.latitude, item.longitude]}
                      radius={emphasized ? 10 : 7}
                      pathOptions={{ color: emphasized ? "#0f172a" : "#ffffff", weight: emphasized ? 3 : 2, fillColor: markerColor(item.health), fillOpacity: 1 }}
                      eventHandlers={{
                        mouseover: () => setActiveSiteKey(item.siteKey),
                        mouseout: () => setActiveSiteKey((current) => (current === item.siteKey ? null : current)),
                        click: () => {
                          setSelectedSiteKey(item.siteKey);
                          setActiveSiteKey(item.siteKey);
                        },
                      }}
                    >
                      <Popup className="nms-map-popup">
                        <div className="min-w-[190px] text-xs text-slate-700">
                          <p className="font-semibold text-slate-950">{item.name}</p>
                          <p className="mt-0.5 text-slate-500">{item.siteKey}</p>
                          <div className="mt-2 space-y-1">
                            <p>Health: <span className="font-medium capitalize text-slate-950">{item.health}</span></p>
                            <p>Devices: <span className="font-medium text-slate-950">{item.deviceCount}</span></p>
                            <p>Online: <span className="font-medium text-slate-950">{item.onlineDeviceCount}</span></p>
                            <p>Active alarms: <span className="font-medium text-slate-950">{item.activeAlarmCount}</span></p>
                            <p>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</p>
                          </div>
                          <Link href={`/sites/${item.siteKey}`} className="nms-map-popup__button mt-3 inline-flex border border-blue-700 bg-blue-700 px-3 py-1.5 text-[11px] font-semibold text-white no-underline">
                            Open site detail
                          </Link>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
            <div className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-700">Mapped Sites</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Hover or click a row to focus marker.</p>
              </div>
              <div className="max-h-[360px] overflow-auto divide-y divide-slate-100">
                {sortedItems.map((item) => {
                  const emphasized = activeSiteKey === item.siteKey || selectedSiteKey === item.siteKey;
                  return (
                    <button
                      key={item.siteKey}
                      type="button"
                      onMouseEnter={() => setActiveSiteKey(item.siteKey)}
                      onMouseLeave={() => setActiveSiteKey((current) => (current === item.siteKey ? null : current))}
                      onClick={() => focusSite(item)}
                      className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${emphasized ? "bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-950">{item.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{item.siteKey}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{item.onlineDeviceCount}/{item.deviceCount} online · {item.activeAlarmCount} alarms</p>
                      </div>
                      <span className={`mt-0.5 inline-flex h-2.5 w-2.5 rounded-full ${healthDotClass(item.health)}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FitMapToSites({ items }: { items: SiteMapItem[] }) {
  const map = useMap();
  const bounds = latLngBounds(items.map((item) => [item.latitude, item.longitude] as [number, number]));
  map.fitBounds(bounds.pad(0.35));
  return null;
}

function markerColor(health: string) {
  switch (health) {
    case "critical":
      return "#dc2626";
    case "warning":
      return "#f59e0b";
    case "normal":
      return "#2563eb";
    default:
      return "#64748b";
  }
}

function healthRank(health: string) {
  switch (health) {
    case "critical":
      return 0;
    case "warning":
      return 1;
    case "normal":
      return 2;
    default:
      return 3;
  }
}

function healthDotClass(health: string) {
  switch (health) {
    case "critical":
      return "bg-red-600";
    case "warning":
      return "bg-amber-500";
    case "normal":
      return "bg-blue-600";
    default:
      return "bg-slate-500";
  }
}
