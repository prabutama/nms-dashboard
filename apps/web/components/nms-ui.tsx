import Link from "next/link";

import { formatMetricValue } from "@/lib/format";
import type { DashboardMetricCard } from "@/lib/types";

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.02em] ${badgeClass(status)}`}>{status}</span>;
}

export function MetricCard({ metric }: { metric: DashboardMetricCard }) {
  return (
    <div className="border border-slate-300 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-800">{metric.label}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-600">{formatMetricValue(metric.value, metric.unit)}</p>
        </div>
        <StatusBadge status={metric.status} />
      </div>
    </div>
  );
}

export function StatCard({ title, value, note, status }: { title: string; value: string | number; note?: string; status?: string }) {
  return (
    <div className={`flex items-center justify-between border border-slate-300 bg-white px-4 py-3 shadow-sm ${status ? `border-l-4 ${statusBorderClass(status)}` : ""}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.02em] text-slate-600">{title}</p>
        <p className="mt-0.5 text-base font-semibold text-slate-950">{value}</p>
        {note ? <p className="mt-0.5 truncate text-[11px] text-slate-600">{note}</p> : null}
      </div>
      {status ? <StatusBadge status={status} /> : null}
    </div>
  );
}

export function DeviceLink({ href, name, type, status }: { href: string; name: string; type: string; status?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 text-sm transition hover:bg-slate-100 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-950">{name}</p>
        <p className="truncate text-xs text-slate-600">{type}</p>
      </div>
      <StatusBadge status={status || "unknown"} />
    </Link>
  );
}

function badgeClass(status: string) {
  switch (status) {
    case "normal":
    case "fresh":
    case "online":
    case "active":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "warning":
    case "stale":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "critical":
    case "offline":
      return "border-red-200 bg-red-100 text-red-800";
    default:
      return "border-slate-300 bg-slate-200 text-slate-700";
  }
}

function statusBorderClass(status: string) {
  switch (status) {
    case "normal":
    case "fresh":
    case "online":
    case "active":
      return "border-l-emerald-500";
    case "warning":
    case "stale":
      return "border-l-amber-500";
    case "critical":
    case "offline":
      return "border-l-red-600";
    default:
      return "border-l-slate-400";
  }
}
