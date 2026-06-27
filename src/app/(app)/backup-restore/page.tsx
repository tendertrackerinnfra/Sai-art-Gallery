import { ModulePage } from "@/components/layout/module-page";
import { requireRole } from "@/lib/auth";

export default async function BackupRestorePage() {
  await requireRole(["Owner"]);
  return <ModulePage title="Backup and Restore" description="Owner-only backup download, restore controls, backup logs, and restore testing workflow." ownerOnly />;
}
