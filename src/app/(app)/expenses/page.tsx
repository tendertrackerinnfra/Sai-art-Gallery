import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function ExpensesPage() {
  await requireCapability("expenses");
  return <ModulePage title="Expenses" description="Record business expenses by category with receipts, payment method, status, and audit trail." />;
}
