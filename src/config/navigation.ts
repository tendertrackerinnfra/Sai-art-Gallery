import {
  IndianRupee,
  ShoppingBag,
  Store,
  Users,
  WalletCards,
} from "lucide-react";

export const navigationItems = [
  { title: "Inventory", href: "/products", icon: ShoppingBag },
  { title: "Sales", href: "/sales", icon: IndianRupee },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Expenses", href: "/expenses", icon: WalletCards },
] as const;

export const appIdentity = {
  name: "Sai Art Gallery",
  businessType: "Handmade jewellery business",
  icon: Store,
};
