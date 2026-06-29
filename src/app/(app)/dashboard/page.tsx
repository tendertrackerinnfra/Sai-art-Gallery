import Link from "next/link";
import { ArrowRight, Boxes, ClipboardList, IndianRupee, PackagePlus } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { requireCapability } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  try {
    const [sales, openOrders, products, lowStockItems] = await Promise.all([
      getDb().sale.aggregate({
        where: { saleDate: { gte: startOfToday }, status: "active" },
        _sum: { grandTotal: true },
      }),
      getDb().customOrder.count({
        where: { status: { in: ["enquiry", "confirmed", "in_progress", "ready"] } },
      }),
      getDb().product.count({ where: { status: "active" } }),
      getDb().$queryRaw<Array<{ count: bigint }>>`
        SELECT (
          (SELECT COUNT(*) FROM products
            WHERE status = 'active' AND quantity_on_hand <= reorder_level)
          +
          (SELECT COUNT(*) FROM raw_materials
            WHERE status = 'active' AND quantity_on_hand <= reorder_level)
        )::bigint AS count
      `,
    ]);

    return {
      databaseError: false,
      metrics: [
        { label: "Today sales", value: formatCurrency(sales._sum.grandTotal?.toString() ?? 0), icon: IndianRupee },
        { label: "Open custom orders", value: String(openOrders), icon: ClipboardList },
        { label: "Active products", value: String(products), icon: Boxes },
        { label: "Low stock items", value: String(lowStockItems[0]?.count ?? 0), icon: PackagePlus },
      ],
    };
  } catch {
    return {
      databaseError: true,
      metrics: [
        { label: "Today sales", value: "-", icon: IndianRupee },
        { label: "Open custom orders", value: "-", icon: ClipboardList },
        { label: "Active products", value: "-", icon: Boxes },
        { label: "Low stock items", value: "-", icon: PackagePlus },
      ],
    };
  }
}

type DashboardPageProps = {
  searchParams: Promise<{ forbidden?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireCapability("dashboard");
  const [{ metrics, databaseError }, { forbidden }] = await Promise.all([
    getDashboardData(),
    searchParams,
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Today&apos;s business and inventory overview.</p>
        </div>
        <Button>
          <Link href="/products" className="inline-flex items-center gap-2">
            Open inventory
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
      {databaseError && (
        <Alert variant="destructive">
          PostgreSQL is not connected. The interface is available, but live totals require the local development database.
        </Alert>
      )}
      {forbidden && (
        <Alert variant="destructive">Your role does not have permission to open that module.</Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="mt-2 text-2xl">{metric.value}</CardTitle>
              </div>
              <span className="rounded-md bg-muted p-2 text-muted-foreground">
                <metric.icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Local business workspace</CardTitle>
          <CardDescription>Finished products and raw materials are ready for daily stock control.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>Add stock, record every adjustment, and archive records without deleting history.</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/products" className="font-medium text-primary hover:underline">Products</Link>
            <Link href="/raw-materials" className="font-medium text-primary hover:underline">Raw materials</Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
