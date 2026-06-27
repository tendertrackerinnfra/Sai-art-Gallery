import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function SalesPage() {
  await requireCapability("sales");
  return <ModulePage title="Sales" description="Record customer sales, sale items, payment status, and stock deductions with audit logging." />;
}
