import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function CustomOrdersPage() {
  await requireCapability("custom-orders");
  return <ModulePage title="Custom Orders" description="Track custom jewellery requests, reference images, advances, status, delivery dates, and payments." />;
}
