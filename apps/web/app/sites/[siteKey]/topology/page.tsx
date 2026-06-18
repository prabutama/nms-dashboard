import { SiteTopologyView } from "@/components/site-topology-view";

export default function TopologyPage({ params }: { params: { siteKey: string } }) {
  return <SiteTopologyView siteKey={params.siteKey} />;
}