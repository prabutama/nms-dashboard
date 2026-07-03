"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatBitrate, formatMetricValue } from "@/lib/format";
import { formatAge, formatTimestamp } from "@/lib/time";
import type { TelemetrySeries } from "@/lib/types";

type TelemetryChartProps = {
  series: TelemetrySeries;
  title?: string;
  unit?: string;
  warn?: number;
  critical?: number;
};

export function TelemetryChart({ series, title, unit, warn, critical }: TelemetryChartProps) {
  const points = series.points
    .filter((point) => point.numeric)
    .map((point) => ({
      timestamp: point.timestamp,
      value: point.value as number,
      time: formatAge(point.timestamp),
      label: formatTimestamp(point.timestamp),
    }));

  if (points.length === 0) {
    return null;
  }

  const formatAxisValue = (value: number) => {
    if (unit === "bps") {
      return formatBitrate(value);
    }
    return formatMetricValue(value, unit);
  };
  const hasWarn = Number.isFinite(warn);
  const hasCritical = Number.isFinite(critical);

  return (
    <div className="border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-slate-800">{title || series.key}</p>
          <p className="mt-0.5 text-[11px] text-slate-600">{points.length} points{unit ? ` · ${unit}` : ""}</p>
        </div>
        {hasWarn || hasCritical ? (
          <div className="flex flex-col items-end gap-0.5 text-[11px] text-slate-600">
            {hasWarn ? <span>Warn {formatMetricValue(warn, unit)}</span> : null}
            {hasCritical ? <span>Critical {formatMetricValue(critical, unit)}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="h-56 px-1 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 10, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.55)" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 11, fill: "#334155" }} minTickGap={20} />
            <YAxis stroke="#475569" tick={{ fontSize: 11, fill: "#334155" }} width={56} tickFormatter={formatAxisValue} />
            {hasWarn ? <ReferenceLine y={warn} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" /> : null}
            {hasCritical ? <ReferenceLine y={critical} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" /> : null}
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #94a3b8",
                borderRadius: "2px",
                color: "#0f172a",
              }}
              formatter={(v: unknown) => formatMetricValue(Number(v), unit)}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
            />
            <Line type="linear" dataKey="value" stroke="#1d4ed8" strokeWidth={2.25} dot={false} activeDot={{ r: 4, stroke: "#1e3a8a", strokeWidth: 1, fill: "#ffffff" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
