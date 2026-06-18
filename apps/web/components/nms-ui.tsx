import Link from "next/link";

import { formatMetricValue } from "@/lib/format";
import type { DashboardMetricCard } from "@/lib/types";

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex px-1.5 py-0.5 text-[11px] font-medium ${badgeClass(status)}`}>{status}</span>;
}

export function MetricCard({ metric }: { metric: DashboardMetricCard }) {
  return (
    <div className="border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-700">{metric.label}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{formatMetricValue(metric.value, metric.unit)}</p>
        </div>
        <StatusBadge status={metric.status} />
      </div>
    </div>
  );
}

export function StatCard({ title, value, note, status }: { title: string; value: string | number; note?: string; status?: string }) {
  return (
    <div className="flex items-center justify-between border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <p className="mt-0.5 text-base font-semibold text-slate-950">{value}</p>
        {note ? <p className="mt-0.5 text-[11px] text-slate-400">{note}</p> : null}
      </div>
      {status ? <StatusBadge status={status} /> : null}
    </div>
  );
}

export function DeviceLink({ href, name, type, status }: { href: string; name: string; type: string; status?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-sm transition hover:bg-blue-50/50 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-950">{name}</p>
        <p className="truncate text-xs text-slate-500">{type}</p>
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
      return "bg-emerald-50 text-emerald-700";
    case "warning":
    case "stale":
      return "bg-amber-50 text-amber-700";
    case "critical":
    case "offline":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}


