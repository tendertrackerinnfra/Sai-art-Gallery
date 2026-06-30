export const roles = ["Owner", "Manager", "Staff", "Accountant"] as const;

export type Role = (typeof roles)[number];

export const roleAccess: Record<Role, string[]> = {
  Owner: ["*"],
  Manager: [
    "dashboard",
    "products",
    "raw-materials",
    "production",
    "sales",
    "billing",
    "purchases",
    "vendors",
    "customers",
    "custom-orders",
    "expenses",
    "finance",
    "payments",
    "reports",
    "settings",
    "audit-logs",
  ],
  Staff: [
    "dashboard",
    "products",
    "raw-materials",
    "production",
    "sales",
    "billing",
    "customers",
    "custom-orders",
    "payments",
  ],
  Accountant: [
    "dashboard",
    "sales",
    "billing",
    "purchases",
    "vendors",
    "customers",
    "expenses",
    "finance",
    "payments",
    "reports",
    "audit-logs",
  ],
};

export const protectedCapabilities = {
  backupDownload: ["Owner"],
  backupRestore: ["Owner"],
  fullProfitReports: ["Owner", "Manager", "Accountant"],
} satisfies Record<string, Role[]>;
