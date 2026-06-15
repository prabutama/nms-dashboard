"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiBaseUrl } from "@/lib/config";
import type { SitesResponse } from "@/lib/types";

async function fetchSites(): Promise<SitesResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/sites`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Site request failed with status ${response.status}`);
  }

  return response.json();
}

export function SiteListCard() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: fetchSites,
  });

  return (
    <Card className="border-white/10 bg-slate-950/55 text-slate-50">
      <CardHeader>
        <CardTitle>Sites</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-300">
        {isLoading ? <p>Loading sites...</p> : null}
        {error ? <p className="text-rose-300">{error.message}</p> : null}
        {data && data.items.length === 0 ? <p>No sites returned from BFF.</p> : null}
        {data && data.items.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((site) => (
              <div key={site.assetId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">{site.type}</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">{site.name}</p>
                <p className="mt-2 text-slate-300">siteKey: {site.siteKey}</p>
                <p className="mt-1 break-all text-xs text-slate-400">assetId: {site.assetId}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
