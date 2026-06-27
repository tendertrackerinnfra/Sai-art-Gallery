import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function PurchasesPage() {
  await requireCapability("purchases");
  return <ModulePage title="Purchases" description="Record raw material and business purchases, purchase items, vendor bills, and purchase payments." />;
}
