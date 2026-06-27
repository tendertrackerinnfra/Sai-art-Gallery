import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function BillingPage() {
  await requireCapability("billing");
  return <ModulePage title="Billing and Invoice Generation" description="Generate invoices with unique numbers such as SAG-2026-0001 and store invoice PDFs locally." />;
}
