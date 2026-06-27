import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function ProductionPage() {
  await requireCapability("production");
  return <ModulePage title="Production / Jewellery Making" description="Plan jewellery making, consume raw materials, and convert completed production into finished product stock." />;
}
