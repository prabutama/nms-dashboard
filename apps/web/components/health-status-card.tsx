"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiBaseUrl } from "@/lib/config";
import type { HealthResponse } from "@/lib/types";

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/health`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json();
}

export function HealthStatusCard() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["bff-health"],
    queryFn: fetchHealth,
  });

  return (
    <Card className="border-white/10 bg-slate-950/55 text-slate-50">
      <CardHeader>
        <CardTitle>BFF health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-300">
        {isLoading ? <p>Checking backend status...</p> : null}
        {error ? <p className="text-rose-300">{error.message}</p> : null}
        {data ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Service</p>
                <p className="mt-1 font-medium text-slate-50">{data.service}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Status</p>
                <p className="mt-1 font-medium text-emerald-300">{data.status}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Cache TTL</p>
                <p className="mt-1 font-medium text-slate-50">{data.config.cacheTtlSeconds}s</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">ThingsBoard Client</p>
                <p className="mt-1 font-medium text-amber-300">{data.config.thingsBoardClientEnabled ? "enabled" : "disabled"}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">Last response at {data.timestamp}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
