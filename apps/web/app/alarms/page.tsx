"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard, StatusBadge } from "@/components/nms-ui";
import { ackAlarm, clearAlarm, fetchAlarms } from "@/lib/api";
import type { Alarm } from "@/lib/types";

function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === "CRITICAL" ? "bg-red-50 text-red-700"
    : severity === "MAJOR" ? "bg-orange-50 text-orange-700"
    : severity === "MINOR" ? "bg-amber-50 text-amber-700"
    : severity === "WARNING" ? "bg-yellow-50 text-yellow-700"
    : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{severity}</span>;
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE_UNACK: "Active / Unack",
    ACTIVE_ACK: "Active / Ack",
    CLEARED_UNACK: "Cleared / Unack",
    CLEARED_ACK: "Cleared / Ack",
  };
  return <span className="text-xs text-slate-600">{map[status] || status}</span>;
}

function tsDisplay(ts?: string) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function AlarmRow({
  alarm,
  onAck,
  onClear,
  pendingAction,
}: {
  alarm: Alarm;
  onAck: (alarmId: string) => void;
  onClear: (alarmId: string) => void;
  pendingAction?: "ack" | "clear" | null;
}) {
  return (
    <tr className="divide-x divide-slate-100">
      <td className="px-4 py-2"><SeverityBadge severity={alarm.severity} /></td>
      <td className="px-4 py-2 text-xs font-medium text-slate-950">{alarm.type}</td>
      <td className="px-4 py-2 text-xs text-slate-600">{alarm.originatorLabel || alarm.originatorName || "-"}</td>
      <td className="px-4 py-2"><StatusLabel status={alarm.status} /></td>
      <td className="px-4 py-2 text-xs text-slate-600">{tsDisplay(alarm.createdAt)}</td>
      <td className="px-4 py-2">{alarm.acknowledged ? <StatusBadge status="normal" /> : <StatusBadge status="warning" />}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {!alarm.acknowledged ? (
            <button
              type="button"
              onClick={() => onAck(alarm.alarmId)}
              disabled={pendingAction !== null}
              className="border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "ack" ? "Acking..." : "Acknowledge"}
            </button>
          ) : null}
          {!alarm.cleared ? (
            <button
              type="button"
              onClick={() => onClear(alarm.alarmId)}
              disabled={pendingAction !== null}
              className="border border-blue-700 bg-blue-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "clear" ? "Clearing..." : "Clear"}
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export default function AlarmsPage() {
  const queryClient = useQueryClient();
  const alarmsQuery = useQuery({
    queryKey: ["alarms"],
    queryFn: () => fetchAlarms({ searchStatus: "ACTIVE", pageSize: 50 }),
    refetchInterval: 30_000,
  });

  const ackMutation = useMutation({
    mutationFn: ackAlarm,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alarms"] });
      await queryClient.invalidateQueries({ queryKey: ["alarms", "overview"] });
      await queryClient.invalidateQueries({ queryKey: ["alarms", "overview-all"] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearAlarm,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alarms"] });
      await queryClient.invalidateQueries({ queryKey: ["alarms", "overview"] });
      await queryClient.invalidateQueries({ queryKey: ["alarms", "overview-all"] });
    },
  });

  const handleAck = (alarmId: string) => {
    ackMutation.mutate(alarmId);
  };

  const handleClear = (alarmId: string) => {
    if (!window.confirm("Clear this alarm?")) {
      return;
    }
    clearMutation.mutate(alarmId);
  };

  const activeAlarms = alarmsQuery.data?.items || [];
  const totalActive = activeAlarms.length;
  const criticalCount = activeAlarms.filter((a) => a.severity === "CRITICAL" || a.severity === "MAJOR").length;

  return (
    <DashboardShell title="Alarms" subtitle="Active and historical alarms across all monitored devices.">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Active Alarms" value={alarmsQuery.isLoading ? "-" : totalActive} />
        <StatCard title="Critical / Major" value={alarmsQuery.isLoading ? "-" : criticalCount} status={criticalCount > 0 ? "critical" : "normal"} />
        <StatCard title="Total (all time)" value={alarmsQuery.data?.totalElements ?? "-"} />
      </div>

      {ackMutation.error ? <p className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{ackMutation.error.message}</p> : null}
      {clearMutation.error ? <p className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{clearMutation.error.message}</p> : null}

      {alarmsQuery.isLoading ? (
        <p className="border border-slate-200 bg-slate-50 px-4 py-5 text-xs text-slate-500">Loading alarms...</p>
      ) : activeAlarms.length === 0 ? (
        <div className="border border-slate-200 bg-white px-6 py-10 text-center text-xs text-slate-500">No active alarms.</div>
      ) : (
        <div className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-700">Active Alarms ({totalActive})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 font-medium text-slate-500">Severity</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Type</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Originator</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Created</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Acked</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeAlarms.map((alarm) => (
                  <AlarmRow
                    key={alarm.alarmId}
                    alarm={alarm}
                    onAck={handleAck}
                    onClear={handleClear}
                    pendingAction={ackMutation.variables === alarm.alarmId && ackMutation.isPending ? "ack" : clearMutation.variables === alarm.alarmId && clearMutation.isPending ? "clear" : null}
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
