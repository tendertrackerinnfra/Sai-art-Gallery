import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function VendorsPage() {
  await requireCapability("vendors");
  return <ModulePage title="Vendors" description="Maintain vendor profiles, contact details, purchase history, and payment status." />;
}
