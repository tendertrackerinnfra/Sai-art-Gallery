import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function RawMaterialsPage() {
  await requireCapability("raw-materials");
  return <ModulePage title="Raw Material Inventory" description="Track beads, wire, stones, chains, hooks, packaging, and other making materials with stock movement history." />;
}
