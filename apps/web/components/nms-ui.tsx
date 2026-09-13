import Link from "next/link";
import type { ReactNode } from "react";

import { formatDateTime, formatMetricValue, freshnessLabel, freshnessState } from "@/lib/format";
import type { DashboardMetricCard } from "@/lib/types";

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${badgeClass(status)}`}>{status}</span>;
}

export function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-h-0 rounded-md border border-slate-300 bg-white shadow-sm ${className}`}>
      <div className="flex min-h-11 items-center justify-between gap-3 rounded-t-md border-b border-slate-300 bg-slate-50 px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-800">{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
      <p className="text-xs font-semibold text-slate-800">{title}</p>
      {detail ? <p className="mt-1 text-[11px] text-slate-600">{detail}</p> : null}
    </div>
  );
}

export function FreshnessStrip({ updatedAt, currentCount, totalCount, refreshSeconds = 60 }: { updatedAt?: string; currentCount?: number; totalCount?: number; refreshSeconds?: number }) {
  const state = freshnessState(updatedAt);
  const current = currentCount ?? 0;
  const total = totalCount ?? 0;
  const tone = state === "current" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : state === "stale" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-300 bg-slate-50 text-slate-700";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border px-3 py-2 text-[11px] ${tone}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 ${state === "current" ? "bg-emerald-500" : state === "stale" ? "bg-amber-500" : "bg-slate-400"}`} />
        <span className="font-semibold uppercase tracking-[0.04em]">Data status</span>
        <span>{freshnessLabel(updatedAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700">
        <span>Last update: <strong className="font-medium text-slate-900">{formatDateTime(updatedAt)}</strong></span>
        <span>Refresh: <strong className="font-medium text-slate-900">{refreshSeconds}s</strong></span>
        <span>Current: <strong className="font-medium text-slate-900">{current}/{total}</strong></span>
      </div>
    </div>
  );
}

export function MetricCard({ metric }: { metric: DashboardMetricCard }) {
  return (
    <div className="rounded-md border border-slate-300 bg-white px-4 py-3 shadow-sm">
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
    <div className={`flex items-center justify-between rounded-md border border-slate-300 bg-white px-4 py-3 shadow-sm ${status ? `border-l-4 ${statusBorderClass(status)}` : ""}`}>
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
