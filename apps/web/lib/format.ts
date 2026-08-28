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
  if (unit === "s" || unit === "seconds") return formatDuration(value);
  if (unit === "KB") return formatStorage(value * 1024);
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "--";
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatStorage(bytes: number): string {
  if (!Number.isFinite(bytes)) return "--";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, "")} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1).replace(/\.0$/, "")} GB`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return `${Number.isInteger(value) ? value.toString() : value.toFixed(1)}%`;
}

export function formatRelativeTime(value?: string): string {
  if (!value) return "unknown";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "unknown";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function formatDateTime(value?: string): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString();
}
