"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard, StatusBadge } from "@/components/nms-ui";
import { fetchAlarms } from "@/lib/api";
import type { Alarm } from "@/lib/types";

function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === "CRITICAL" ? "border border-red-200 bg-red-100 text-red-800"
    : severity === "MAJOR" ? "border border-orange-200 bg-orange-100 text-orange-800"
    : severity === "MINOR" ? "border border-amber-200 bg-amber-100 text-amber-800"
    : severity === "WARNING" ? "border border-yellow-200 bg-yellow-100 text-yellow-800"
    : "border border-slate-300 bg-slate-200 text-slate-700";
  return <span className={`inline-flex px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{severity}</span>;
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE_UNACK: "Active / Unack",
    ACTIVE_ACK: "Active / Ack",
    CLEARED_UNACK: "Cleared / Unack",
    CLEARED_ACK: "Cleared / Ack",
  };
  return <span className="text-xs text-slate-700">{map[status] || status}</span>;
}

function tsDisplay(ts?: string) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function AlarmRow({
  alarm,
}: {
  alarm: Alarm;
}) {
  return (
    <tr className="divide-x divide-slate-100">
      <td className="px-4 py-2"><SeverityBadge severity={alarm.severity} /></td>
      <td className="px-4 py-2 text-xs font-medium text-slate-950">{alarm.type}</td>
      <td className="px-4 py-2 text-xs text-slate-700">{alarm.originatorLabel || alarm.originatorName || "-"}</td>
      <td className="px-4 py-2"><StatusLabel status={alarm.status} /></td>
      <td className="px-4 py-2 text-xs text-slate-700">{tsDisplay(alarm.createdAt)}</td>
      <td className="px-4 py-2">{alarm.acknowledged ? <StatusBadge status="normal" /> : <StatusBadge status="warning" />}</td>
      <td className="px-4 py-2 text-xs text-slate-600">Read only</td>
    </tr>
  );
}

export default function AlarmsPage() {
  const alarmsQuery = useQuery({
    queryKey: ["alarms"],
    queryFn: () => fetchAlarms({ searchStatus: "ACTIVE", pageSize: 50 }),
    refetchInterval: 30_000,
  });

  const activeAlarms = alarmsQuery.data?.items || [];
  const totalActive = activeAlarms.length;
  const criticalCount = activeAlarms.filter((a) => a.severity === "CRITICAL" || a.severity === "MAJOR").length;

  return (
    <DashboardShell title="Alarms" subtitle="Active and historical alarms across all monitored devices.">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Active Alarms" value={alarmsQuery.isLoading ? "-" : totalActive} />
        <StatCard title="Critical / Major" value={alarmsQuery.isLoading ? "-" : criticalCount} status={criticalCount > 0 ? "critical" : "normal"} />
        <StatCard title="Access" value="Read Only" status="unknown" />
      </div>

      {alarmsQuery.isLoading ? (
        <p className="border border-slate-300 bg-slate-100 px-4 py-5 text-xs text-slate-600 shadow-sm">Loading alarms...</p>
      ) : activeAlarms.length === 0 ? (
        <div className="border border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-600 shadow-sm">No active alarms.</div>
      ) : (
        <div className="border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-300 bg-slate-100 px-4 py-3">
            <p className="text-xs font-semibold text-slate-800">Active Alarms ({totalActive})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100/80">
                  <th className="px-4 py-2 font-semibold text-slate-700">Severity</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Originator</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Created</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Acked</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeAlarms.map((alarm) => (
                  <AlarmRow
                    key={alarm.alarmId}
                    alarm={alarm}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
