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
    <div className="border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">{title || series.key}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{points.length} points{unit ? ` · ${unit}` : ""}</p>
        </div>
        {hasWarn || hasCritical ? (
          <div className="flex flex-col items-end gap-0.5 text-[11px] text-slate-500">
            {hasWarn ? <span>Warn {formatMetricValue(warn, unit)}</span> : null}
            {hasCritical ? <span>Critical {formatMetricValue(critical, unit)}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="h-56 px-1 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 10, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="rgba(203, 213, 225, 0.8)" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} minTickGap={20} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={56} tickFormatter={formatAxisValue} />
            {hasWarn ? <ReferenceLine y={warn} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" /> : null}
            {hasCritical ? <ReferenceLine y={critical} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" /> : null}
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "2px",
                color: "#0f172a",
              }}
              formatter={(v: unknown) => formatMetricValue(Number(v), unit)}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
            />
            <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
