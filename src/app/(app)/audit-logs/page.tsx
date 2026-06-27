import { ModulePage } from "@/components/layout/module-page";
import { requireCapability } from "@/lib/auth";

export default async function AuditLogsPage() {
  await requireCapability("audit-logs");
  return <ModulePage title="Audit Logs" description="Review financial changes, stock changes, backup and restore actions, authentication events, and sensitive operations." />;
}
