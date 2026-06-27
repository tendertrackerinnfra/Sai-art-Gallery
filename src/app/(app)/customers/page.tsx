import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function CustomersPage() {
  await requireCapability("customers");
  return <ModulePage title="Customers" description="Manage customer profiles, custom order history, sales, invoices, and payment records." />;
}
