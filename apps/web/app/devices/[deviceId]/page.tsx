import { DeviceDetailDashboard } from "@/components/device-detail-dashboard";

export default function DeviceDetailPage({ params }: { params: { deviceId: string } }) {
  return <DeviceDetailDashboard deviceId={params.deviceId} />;
}
