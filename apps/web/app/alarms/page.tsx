"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { StatCard, StatusBadge } from "@/components/nms-ui";
import { ackAlarm, clearAlarm, fetchAlarms } from "@/lib/api";
import type { Alarm, AlarmListResponse } from "@/lib/types";

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

function patchAlarmList(
  current: AlarmListResponse | undefined,
  alarmId: string,
  updater: (alarm: Alarm) => Alarm | null,
): AlarmListResponse | undefined {
  if (!current) {
    return current;
  }

  const items = current.items
    .map((alarm) => {
      if (alarm.alarmId !== alarmId) {
        return alarm;
      }
      return updater(alarm);
    })
    .filter((alarm): alarm is Alarm => alarm !== null);

  return {
    ...current,
    items,
    totalElements: items.length,
    totalPages: items.length === 0 ? 0 : current.totalPages,
    hasNext: false,
  };
}

async function invalidateAlarmQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["alarms"] }),
    queryClient.invalidateQueries({ queryKey: ["alarms", "overview"] }),
    queryClient.invalidateQueries({ queryKey: ["alarms", "overview-all"] }),
    queryClient.invalidateQueries({ queryKey: ["site-alarms"] }),
    queryClient.invalidateQueries({ queryKey: ["device-alarms"] }),
    queryClient.invalidateQueries({ queryKey: ["report-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["reports-sites"] }),
    queryClient.invalidateQueries({ queryKey: ["reports-devices"] }),
  ]);
}

function AlarmRow({
  alarm,
  onAck,
  onClear,
  pendingAction,
  canManage,
}: {
  alarm: Alarm;
  onAck: (alarmId: string) => void;
  onClear: (alarmId: string) => void;
  pendingAction?: "ack" | "clear" | null;
  canManage: boolean;
}) {
  return (
    <tr className="divide-x divide-slate-100">
      <td className="px-4 py-2"><SeverityBadge severity={alarm.severity} /></td>
      <td className="px-4 py-2 text-xs font-medium text-slate-950">{alarm.type}</td>
      <td className="px-4 py-2 text-xs text-slate-700">{alarm.originatorLabel || alarm.originatorName || "-"}</td>
      <td className="px-4 py-2"><StatusLabel status={alarm.status} /></td>
      <td className="px-4 py-2 text-xs text-slate-700">{tsDisplay(alarm.createdAt)}</td>
      <td className="px-4 py-2">{alarm.acknowledged ? <StatusBadge status="normal" /> : <StatusBadge status="warning" />}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {canManage && !alarm.acknowledged ? (
            <button
              type="button"
              onClick={() => onAck(alarm.alarmId)}
              disabled={pendingAction !== null}
              className="border border-slate-400 px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "ack" ? "Acking..." : "Acknowledge"}
            </button>
          ) : null}
          {canManage && !alarm.cleared ? (
            <button
              type="button"
              onClick={() => onClear(alarm.alarmId)}
              disabled={pendingAction !== null}
              className="border border-blue-800 bg-blue-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
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
  const router = useRouter();
  const { user, isAuthenticated, ready } = useAuth();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const alarmsQuery = useQuery({
    queryKey: ["alarms"],
    queryFn: () => fetchAlarms({ searchStatus: "ACTIVE", pageSize: 50 }),
    refetchInterval: 30_000,
  });

  const ackMutation = useMutation({
    mutationFn: ackAlarm,
    onMutate: async (alarmId) => {
      setFeedback(null);
      await queryClient.cancelQueries({ queryKey: ["alarms"] });
      const previous = queryClient.getQueryData<AlarmListResponse>(["alarms"]);
      queryClient.setQueryData<AlarmListResponse | undefined>(["alarms"], (current) => patchAlarmList(current, alarmId, (alarm) => ({
        ...alarm,
        acknowledged: true,
        status: alarm.cleared ? "CLEARED_ACK" : "ACTIVE_ACK",
        ackAt: alarm.ackAt || new Date().toISOString(),
      })));
      return { previous };
    },
    onError: (error, _alarmId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["alarms"], context.previous);
      }
      setFeedback({ type: "error", message: error.message });
    },
    onSuccess: async () => {
      setFeedback({ type: "success", message: "Alarm acknowledged." });
      await invalidateAlarmQueries(queryClient);
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearAlarm,
    onMutate: async (alarmId) => {
      setFeedback(null);
      await queryClient.cancelQueries({ queryKey: ["alarms"] });
      const previous = queryClient.getQueryData<AlarmListResponse>(["alarms"]);
      queryClient.setQueryData<AlarmListResponse | undefined>(["alarms"], (current) => patchAlarmList(current, alarmId, () => null));
      return { previous };
    },
    onError: (error, _alarmId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["alarms"], context.previous);
      }
      setFeedback({ type: "error", message: error.message });
    },
    onSuccess: async () => {
      setFeedback({ type: "success", message: "Alarm cleared." });
      await invalidateAlarmQueries(queryClient);
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
  const canManage = user?.authority === "TENANT_ADMIN" || user?.authority === "SYS_ADMIN";

  if (ready && !isAuthenticated) {
    router.replace("/login");
    return null;
  }

  return (
    <DashboardShell title="Alarms" subtitle="Active and historical alarms across all monitored devices.">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Active Alarms" value={alarmsQuery.isLoading ? "-" : totalActive} />
        <StatCard title="Critical / Major" value={alarmsQuery.isLoading ? "-" : criticalCount} status={criticalCount > 0 ? "critical" : "normal"} />
        <StatCard title="Access" value={canManage ? "Operator" : "Read Only"} status={canManage ? "normal" : "unknown"} />
      </div>

      {feedback ? (
        <p className={feedback.type === "success"
          ? "border border-emerald-200 bg-emerald-100 px-4 py-3 text-xs text-emerald-800"
          : "border border-red-200 bg-red-100 px-4 py-3 text-xs text-red-800"}
        >
          {feedback.message}
        </p>
      ) : null}

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
                    onAck={handleAck}
                    onClear={handleClear}
                    pendingAction={ackMutation.variables === alarm.alarmId && ackMutation.isPending ? "ack" : clearMutation.variables === alarm.alarmId && clearMutation.isPending ? "clear" : null}
                    canManage={canManage}
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
