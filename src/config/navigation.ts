import {
  ArchiveRestore,
  Boxes,
  ClipboardList,
  CreditCard,
  Gauge,
  Hammer,
  IndianRupee,
  Landmark,
  PackageOpen,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";

export const navigationItems = [
  { title: "Dashboard", href: "/dashboard", icon: Gauge },
  { title: "Product Inventory", href: "/products", icon: ShoppingBag },
  { title: "Raw Material Inventory", href: "/raw-materials", icon: Boxes },
  { title: "Production", href: "/production", icon: Hammer },
  { title: "Sales", href: "/sales", icon: IndianRupee },
  { title: "Billing & Invoices", href: "/billing", icon: ReceiptText },
  { title: "Purchases", href: "/purchases", icon: PackageOpen },
  { title: "Vendors", href: "/vendors", icon: Truck },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Custom Orders", href: "/custom-orders", icon: ClipboardList },
  { title: "Expenses", href: "/expenses", icon: WalletCards },
  { title: "Payments", href: "/payments", icon: CreditCard },
  { title: "Reports", href: "/reports", icon: ScrollText },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Backup & Restore", href: "/backup-restore", icon: ArchiveRestore },
  { title: "Audit Logs", href: "/audit-logs", icon: ShieldCheck },
] as const;

export const appIdentity = {
  name: "Sai Art Gallery",
  businessType: "Handmade jewellery business",
  icon: Store,
};

