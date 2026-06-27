import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function SettingsPage() {
  await requireCapability("settings");
  return <ModulePage title="Settings" description="Configure business profile, invoice numbering, SKU prefixes, storage paths, roles, and application preferences." />;
}
