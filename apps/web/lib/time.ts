export function formatTimestamp(timestamp?: number) {
  if (!timestamp) {
    return "none";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(timestamp));
}

export function formatAge(timestamp?: number) {
  if (!timestamp) {
    return "unknown age";
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getFreshness(timestamp?: number, staleAfterMs = 5 * 60 * 1000) {
  if (!timestamp) {
    return {
      label: "unknown",
      className: "border-slate-500/30 bg-slate-500/10 text-slate-300",
    };
  }

  if (Date.now() - timestamp > staleAfterMs) {
    return {
      label: "stale",
      className: "border-amber-300/30 bg-amber-300/10 text-amber-200",
    };
  }

  return {
    label: "fresh",
    className: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  };
}
