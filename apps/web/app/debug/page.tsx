"use client";

import { useAuth } from "@/components/auth-provider";
import { ComingSoonPage } from "@/components/dashboard-shell";

export default function DebugPage() {
	const { user } = useAuth();
	if (user?.authority !== "TENANT_ADMIN" && user?.authority !== "SYS_ADMIN") {
		return <ComingSoonPage title="Access Denied" />;
	}
  return <ComingSoonPage title="Settings / Debug" />;
}
