import { SiteDetailDashboard } from "@/components/site-detail-dashboard";

export default function SiteDetailPage({ params }: { params: { siteKey: string } }) {
  return <SiteDetailDashboard siteKey={params.siteKey} />;
}
