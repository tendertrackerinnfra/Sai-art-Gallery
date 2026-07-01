import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { Activity, ArrowRight, Boxes, IndianRupee, PackagePlus, Receipt, Sparkles, Wallet } from "lucide-react";

import { DatabaseUnavailableAlert } from "@/components/shared/database-unavailable-alert";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCapability } from "@/lib/auth";
import { dataCacheTags } from "@/lib/data-cache";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

function getRange(range: string) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (range === "week") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
  } else if (range === "month") {
    start.setDate(1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function getDashboardData(rangeKey: string) {
  const { start, end } = getRange(rangeKey);

  try {
    const [sales, salePayments, openOrders, activeSales, paidSaleTotals, inventoryProducts, recentMovements, recentExpenses] = await Promise.all([
      getDb().sale.aggregate({
        where: { saleDate: { gte: start, lte: end }, status: "active" },
        _sum: { grandTotal: true },
      }),
      getDb().salePayment.aggregate({
        where: {
          paymentDate: { gte: start, lte: end },
          status: "paid",
          sale: { status: "active" },
        },
        _sum: { amount: true },
      }),
      getDb().customOrder.count({
        where: { status: { in: ["enquiry", "confirmed", "in_progress", "ready"] } },
      }),
      getDb().sale.findMany({
        where: { status: "active" },
        select: {
          id: true,
          grandTotal: true,
        },
      }),
      getDb().salePayment.groupBy({
        by: ["saleId"],
        where: {
          status: "paid",
          sale: { status: "active" },
        },
        _sum: { amount: true },
      }),
      getDb().product.findMany({
        where: { status: "active" },
        select: {
          id: true,
          name: true,
          sku: true,
          quantityOnHand: true,
          reorderLevel: true,
          sellingPrice: true,
          category: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
      getDb().productStockMovement.findMany({
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      getDb().expense.findMany({
        where: { status: "active" },
        include: { category: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const paidBySaleId = new Map(
      paidSaleTotals.map((payment) => [payment.saleId, Number(payment._sum.amount ?? 0)]),
    );
    const receivables = activeSales.reduce(
      (total, sale) => total + Math.max(0, Number(sale.grandTotal) - (paidBySaleId.get(sale.id) ?? 0)),
      0,
    );

    const inventoryValue = inventoryProducts.reduce(
      (total, product) => total + Number(product.sellingPrice) * product.quantityOnHand,
      0,
    );

    const lowStock = inventoryProducts
      .filter((item) => item.quantityOnHand <= item.reorderLevel)
      .sort((a, b) => a.quantityOnHand - b.quantityOnHand || a.reorderLevel - b.reorderLevel)
      .slice(0, 10);

    const recentActivity = [
      ...recentMovements.map((movement) => ({
        id: movement.id,
        date: movement.createdAt,
        title: movement.product.name,
        description: `${movement.type.replaceAll("_", " ")} - ${movement.reference ?? "No reference"}`,
        amount: movement.quantity,
        kind: "stock" as const,
      })),
      ...recentExpenses.map((expense) => ({
        id: expense.id,
        date: expense.createdAt,
        title: expense.title,
        description: `${expense.category.name} - ${expense.method?.replaceAll("_", " ") ?? "other"}`,
        amount: Number(expense.amount),
        kind: "expense" as const,
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);

    return {
      databaseError: false,
      salesTotal: Number(sales._sum.grandTotal ?? 0),
      paymentTotal: Number(salePayments._sum.amount ?? 0),
      openOrders,
      inventoryValue,
      receivables,
      productsCount: inventoryProducts.length,
      lowStock,
      recentActivity,
    };
  } catch {
    return {
      databaseError: true,
      salesTotal: 0,
      paymentTotal: 0,
      openOrders: 0,
      inventoryValue: 0,
      receivables: 0,
      productsCount: 0,
      lowStock: [],
      recentActivity: [],
    };
  }
}

const getDashboardDataCached = unstable_cache(
  async (rangeKey: string) => getDashboardData(rangeKey),
  ["dashboard-data"],
  {
    revalidate: 30,
    tags: [
      dataCacheTags.dashboard,
      dataCacheTags.products,
      dataCacheTags.sales,
      dataCacheTags.expenses,
      dataCacheTags.finance,
    ],
  },
);

type DashboardPageProps = {
  searchParams: Promise<{ forbidden?: string; range?: string }>;
};

const rangeOptions = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
] as const;

function DashboardContentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded-full bg-muted" />
              <div className="h-8 w-28 rounded-xl bg-muted" />
              <div className="h-3 w-32 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((__, row) => (
                <div key={row} className="h-20 rounded-2xl bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function DashboardContent({ selectedRange }: { selectedRange: "today" | "week" | "month" }) {
  const cachedData = await getDashboardDataCached(selectedRange);
  const data = {
    ...cachedData,
    recentActivity: cachedData.recentActivity.map((item) => ({
      ...item,
      date: new Date(item.date),
    })),
  };

  return (
    <>
      {data.databaseError && <DatabaseUnavailableAlert scope="Dashboard" />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={IndianRupee} label="Sales" value={formatCurrency(data.salesTotal)} helper="Completed sale totals in the selected range" />
        <StatCard icon={Wallet} label="Payments" value={formatCurrency(data.paymentTotal)} helper="Recorded incoming payments" />
        <StatCard icon={Receipt} label="Receivables" value={formatCurrency(data.receivables)} helper="Outstanding balance from active sales" />
        <StatCard icon={Boxes} label="Inventory value" value={formatCurrency(data.inventoryValue)} helper={`${data.productsCount} active products`} />
        <StatCard icon={PackagePlus} label="Low stock" value={data.lowStock.length} helper="Products at or below reorder level" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription className="mt-1.5">Latest stock and expense activity across the workspace.</CardDescription>
            </div>
            <StatusBadge tone="pending" label={`${data.openOrders} open custom orders`} />
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivity.length === 0 ? (
              <EmptyState icon={Activity} title="No recent activity" description="New stock movements, expenses, and other tracked activity will appear here." />
            ) : (
              data.recentActivity.map((item) => (
                <div key={`${item.kind}-${item.id}`} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${item.kind === "expense" ? "text-rose-700" : "text-emerald-700"}`}>
                      {item.kind === "expense" ? formatCurrency(item.amount) : `${item.amount > 0 ? "+" : ""}${item.amount}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.date)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription className="mt-1.5">Common daily actions for billing, stock, customers, and expenses.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/sales" className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-4 transition hover:bg-muted">
              <p className="font-medium">Record sale</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a new sale and capture payment status.</p>
            </Link>
            <Link href="/products" className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-4 transition hover:bg-muted">
              <p className="font-medium">Manage inventory</p>
              <p className="mt-1 text-sm text-muted-foreground">Add finished jewellery products or adjust stock.</p>
            </Link>
            <Link href="/customers" className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-4 transition hover:bg-muted">
              <p className="font-medium">Open customers</p>
              <p className="mt-1 text-sm text-muted-foreground">Review customer profiles and outstanding balances.</p>
            </Link>
            <Link href="/expenses" className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-4 transition hover:bg-muted">
              <p className="font-medium">Record expense</p>
              <p className="mt-1 text-sm text-muted-foreground">Post an operating cost with payment method and receipt reference.</p>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Low stock alerts</CardTitle>
            <CardDescription className="mt-1.5">Products that need attention before they block future sales.</CardDescription>
          </div>
          <Link href="/products">
            <Button variant="outline">
              Open inventory
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {data.lowStock.length === 0 ? (
            <EmptyState icon={PackagePlus} title="Stock levels look healthy" description="No active products are currently at or below reorder level." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.lowStock.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.sku} - {item.category.name}</p>
                    </div>
                    <StatusBadge tone={item.quantityOnHand <= 0 ? "out_of_stock" : "low_stock"} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">On hand</span>
                    <span className="font-medium">{item.quantityOnHand}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reorder level</span>
                    <span className="font-medium">{item.reorderLevel}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireCapability("dashboard");
  const params = await searchParams;
  const selectedRange = rangeOptions.some((item) => item.key === params.range) ? (params.range as "today" | "week" | "month") : "today";

  return (
    <section className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Track daily business performance, stock pressure, incoming cash, and recent activity across the jewellery operation."
        badge={<StatusBadge tone="active" label="Live business overview" />}
        actions={
          <>
            <div className="inline-flex rounded-2xl border border-border bg-card p-1">
              {rangeOptions.map((option) => (
                <Link
                  key={option.key}
                  href={option.key === "today" ? "/dashboard" : `/dashboard?range=${option.key}`}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${selectedRange === option.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
            <Link href="/sales">
              <Button>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                New sale
              </Button>
            </Link>
          </>
        }
      />

      {params.forbidden && <Alert variant="destructive">Your role does not have permission to open that module.</Alert>}

      <Suspense fallback={<DashboardContentLoading />}>
        <DashboardContent selectedRange={selectedRange} />
      </Suspense>
    </section>
  );
}
