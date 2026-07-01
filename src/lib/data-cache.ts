import { revalidateTag } from "next/cache";

export const dataCacheTags = {
  dashboard: "dashboard",
  customers: "customers",
  finance: "finance",
  products: "products",
  sales: "sales",
  expenses: "expenses",
} as const;

export type DataCacheTag = (typeof dataCacheTags)[keyof typeof dataCacheTags];

export function revalidateAppData(...tags: DataCacheTag[]) {
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
}
