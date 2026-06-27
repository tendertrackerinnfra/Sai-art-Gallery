import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function PaymentsPage() {
  await requireCapability("payments");
  return <ModulePage title="Payments" description="Track sale payments, purchase payments, custom order payments, partial payments, and balances." />;
}
