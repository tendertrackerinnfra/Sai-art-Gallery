export const storagePaths = {
  uploads: process.env.UPLOADS_PATH ?? "H:\\BMC\\Project\\0.SAG\\uploads",
  invoices: process.env.INVOICES_PATH ?? "H:\\BMC\\Project\\0.SAG\\invoices",
  reports: process.env.REPORTS_PATH ?? "H:\\BMC\\Project\\0.SAG\\reports",
  backups: process.env.BACKUPS_PATH ?? "H:\\BMC\\Project\\0.SAG\\backups",
  exports: process.env.EXPORTS_PATH ?? "H:\\BMC\\Project\\0.SAG\\exports",
} as const;

