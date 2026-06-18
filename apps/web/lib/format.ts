export function formatBitrate(bps: number): string {
  if (bps < 1000) return `${Math.round(bps)} bps`;
  if (bps < 1_000_000) return `${(bps / 1_000).toFixed(1).replace(/\.0$/, "")} Kbps`;
  if (bps < 1_000_000_000) return `${(bps / 1_000_000).toFixed(1).replace(/\.0$/, "")} Mbps`;
  return `${(bps / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} Gbps`;
}

export function formatMetricValue(value: unknown, unit?: string): string {
  if (typeof value !== "number") {
    if (typeof value === "boolean") return value ? "yes" : "no";
    if (typeof value === "string") return value;
    return "--";
  }
  if (unit === "bps") return formatBitrate(value);
  if (unit === "%" || unit === "percent") return `${Number.isInteger(value) ? value.toString() : value.toFixed(1)}%`;
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
