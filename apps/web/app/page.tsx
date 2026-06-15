import { Activity, Network, Server, ShieldCheck } from "lucide-react";

import { HealthStatusCard } from "@/components/health-status-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiBaseUrl } from "@/lib/config";

const overviewItems = [
  {
    title: "Sites",
    value: "0",
    description: "Phase 1 placeholder for site inventory.",
    icon: Network,
  },
  {
    title: "Devices",
    value: "0",
    description: "Device list arrives in later phases.",
    icon: Server,
  },
  {
    title: "Telemetry",
    value: "Pending",
    description: "ThingsBoard integration not enabled in Phase 1.",
    icon: Activity,
  },
  {
    title: "Access Model",
    value: "Open MVP",
    description: "No auth or RBAC in Phase 1 skeleton.",
    icon: ShieldCheck,
  },
];

export default function Home() {
  const apiBaseUrl = getApiBaseUrl();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div className="grid gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:p-8">
            <aside className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">NMS Dashboard</p>
              <h1 className="mt-3 text-2xl font-semibold">Phase 1 control surface</h1>
              <p className="mt-3 text-sm text-slate-300">
                Frontend shell ready. BFF health wired. ThingsBoard integration stays disabled until later phase.
              </p>

              <div className="mt-8 space-y-3 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-slate-400">API Base URL</p>
                  <p className="mt-1 break-all font-medium text-slate-100">{apiBaseUrl}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-slate-400">Backend Contract</p>
                  <p className="mt-1 font-medium text-slate-100">`/health` and `/api/v1/health`</p>
                </div>
              </div>
            </aside>

            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {overviewItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Card key={item.title} className="border-white/10 bg-slate-950/55 text-slate-50">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <CardTitle className="text-sm font-medium text-slate-200">{item.title}</CardTitle>
                        <Icon className="h-4 w-4 text-cyan-300" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold">{item.value}</div>
                        <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <HealthStatusCard />

                <Card className="border-white/10 bg-slate-950/55 text-slate-50">
                  <CardHeader>
                    <CardTitle>Build direction</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-slate-300">
                    <p>Phase 1 keeps platform thin: stateless BFF, no database, no auth, no direct ThingsBoard calls from browser.</p>
                    <p>Next phases add normalized site, device, telemetry, and alarm APIs behind BFF boundary.</p>
                    <p>UI layout already reserved for overview, inventory, and detail workflows.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
