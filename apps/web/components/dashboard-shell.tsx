"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Bell, Database, FileText, Home, Map, Server, Settings } from "lucide-react";

import { useAuth } from "@/components/auth-provider";

const navItems = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/sites", label: "Sites", icon: Map },
  { href: "/devices", label: "Devices", icon: Server },
  { href: "/alarms", label: "Alarms", icon: Bell },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function DashboardShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, ready } = useAuth();

  if (ready && !isAuthenticated) {
    router.replace("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 w-[260px] border-r border-slate-200 bg-white">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center bg-blue-600 text-white">
              <Activity className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">NMS Dashboard</p>
              <p className="text-[11px] text-slate-500">Operations Console</p>
            </div>
          </div>

          <nav className="flex-1 space-y-0.5 px-3 py-4">
            {navItems.filter((item) => !item.adminOnly || user?.authority === "TENANT_ADMIN" || user?.authority === "SYS_ADMIN").map((item) => {
              const Icon = item.icon;
              const selected = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition ${selected ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 px-5 py-4">
            {isAuthenticated && user ? (
              <div className="space-y-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-700">{user.firstName || user.email}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{user.authority}</p>
                </div>
                <button type="button" onClick={() => void logout()} className="border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">Logout</button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-700">Guest</p>
                <p className="mt-1 text-[11px] text-slate-500">Sign in with ThingsBoard user.</p>
                <Link href="/login" className="inline-flex border border-blue-700 bg-blue-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-800">Login</Link>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600">Monitoring</p>
              <h1 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h1>
            </div>
          </div>
          {subtitle ? <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="space-y-4 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <DashboardShell title={title} subtitle="Dedicated page planned for next iteration.">
      <div className="border border-slate-200 bg-white px-6 py-10 text-center">
        <Database className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-semibold text-slate-950">Page scaffold ready</p>
        <p className="mt-1 text-xs text-slate-500">Data model and BFF endpoint can be added incrementally.</p>
      </div>
    </DashboardShell>
  );
}
