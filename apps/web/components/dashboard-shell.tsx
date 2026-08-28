"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, ChevronLeft, ChevronRight, Database, FileText, Home, Map, Menu, Server, X } from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/sites", label: "Sites", icon: Map },
  { href: "/devices", label: "Devices", icon: Server },
  { href: "/alarms", label: "Alarms", icon: Bell },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function DashboardShell({ title, subtitle, actions, children }: { title: string; subtitle: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarWidthClass = collapsed ? "lg:w-[72px]" : "lg:w-[260px]";
  const contentOffsetClass = collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]";

  return (
    <div className="min-h-screen bg-slate-100">
      {mobileOpen ? <button type="button" aria-label="Close navigation overlay" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-slate-300 bg-white shadow-sm transition-transform duration-200 lg:translate-x-0 ${sidebarWidthClass} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center border-b border-slate-300 px-4 py-4 ${collapsed ? "justify-center lg:px-3" : "gap-3 lg:px-5"}`}>
            <div className="flex h-9 w-9 items-center justify-center border border-blue-800 bg-blue-700 text-white">
              <Activity className="h-[18px] w-[18px]" />
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">NMS Dashboard</p>
                <p className="text-[11px] text-slate-600">Operations Console</p>
              </div>
            ) : null}
            <button
              type="button"
              aria-label={mobileOpen ? "Close navigation" : "Collapse navigation"}
              className="ml-auto inline-flex h-9 w-9 items-center justify-center border border-slate-300 text-slate-700 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              className="ml-auto hidden h-9 w-9 items-center justify-center border border-slate-300 text-slate-700 hover:bg-slate-100 lg:inline-flex"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const selected = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center border px-3 py-2 text-sm font-medium transition ${collapsed ? "justify-center" : "gap-3"} ${selected ? "border-blue-800 bg-blue-700 text-white" : "border-transparent text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className={`border-t border-slate-300 py-4 ${collapsed ? "px-3" : "px-5"}`}>
            <div className={`space-y-2 ${collapsed ? "flex flex-col items-center text-center" : ""}`}>
              <p className="text-[11px] font-semibold text-slate-800">{collapsed ? "RO" : "Public Demo"}</p>
              {!collapsed ? <p className="mt-1 text-[11px] text-slate-600">Read-only portfolio access.</p> : null}
            </div>
          </div>
        </div>
      </aside>

      <div className={contentOffsetClass}>
        <div className="border-b border-slate-300 bg-white px-4 py-3 shadow-sm sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 text-slate-700 hover:bg-slate-100 lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.03em] text-blue-700">Monitoring</p>
                <h1 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h1>
              </div>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
          {subtitle ? <p className="mt-0.5 max-w-3xl text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <div className="space-y-4 px-4 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <DashboardShell title={title} subtitle="Dedicated page planned for next iteration.">
      <div className="border border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
        <Database className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm font-semibold text-slate-950">Page scaffold ready</p>
        <p className="mt-1 text-xs text-slate-600">Data model and BFF endpoint can be added incrementally.</p>
      </div>
    </DashboardShell>
  );
}
