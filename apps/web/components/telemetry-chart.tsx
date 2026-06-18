"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatBitrate } from "@/lib/format";
import { formatAge, formatTimestamp } from "@/lib/time";
import type { TelemetrySeries } from "@/lib/types";

type TelemetryChartProps = {
  series: TelemetrySeries;
  title?: string;
  unit?: string;
};

export function TelemetryChart({ series, title, unit }: TelemetryChartProps) {
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

  return (
    <div className="border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">{title || series.key}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{points.length} points{unit ? ` · ${unit}` : ""}</p>
        </div>
      </div>
      <div className="h-56 px-1 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 10, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="rgba(203, 213, 225, 0.8)" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} minTickGap={20} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={56}
              tickFormatter={unit === "bps" ? (v: number) => formatBitrate(v) : undefined} />
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "2px",
                color: "#0f172a",
              }}
              formatter={unit === "bps" ? (v: unknown) => formatBitrate(Number(v)) : undefined}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
            />
            <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
