import { Suspense } from "react";
import { ReportsDashboard } from "@/components/reports-dashboard";

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsDashboard />
    </Suspense>
  );
}
