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
    <Card className="border-slate-300 bg-white text-slate-950 shadow-sm">
      <CardHeader>
        <CardTitle>BFF health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-700">
        {isLoading ? <p>Checking backend status...</p> : null}
        {error ? <p className="text-red-700">{error.message}</p> : null}
        {data ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm border border-slate-300 bg-slate-100 p-3">
                <p className="text-slate-600">Service</p>
                <p className="mt-1 font-medium text-slate-950">{data.service}</p>
              </div>
              <div className="rounded-sm border border-slate-300 bg-slate-100 p-3">
                <p className="text-slate-600">Status</p>
                <p className="mt-1 font-medium text-emerald-700">{data.status}</p>
              </div>
              <div className="rounded-sm border border-slate-300 bg-slate-100 p-3">
                <p className="text-slate-600">Cache TTL</p>
                <p className="mt-1 font-medium text-slate-950">{data.config.cacheTtlSeconds}s</p>
              </div>
              <div className="rounded-sm border border-slate-300 bg-slate-100 p-3">
                <p className="text-slate-600">ThingsBoard Client</p>
                <p className="mt-1 font-medium text-amber-700">{data.config.thingsBoardClientEnabled ? "enabled" : "disabled"}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">Last response at {data.timestamp}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
