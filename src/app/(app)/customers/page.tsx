import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { Archive, IndianRupee, Mail, MapPin, Pencil, Phone, Search, ShoppingBag, UserPlus, Users } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { DatabaseUnavailableAlert } from "@/components/shared/database-unavailable-alert";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireCapability } from "@/lib/auth";
import { dataCacheTags } from "@/lib/data-cache";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { isMobileRequest } from "@/lib/request-device";

import { archiveCustomer, createCustomer, updateCustomer } from "./actions";

type CustomersPageProps = {
  searchParams: Promise<{ success?: string; error?: string; q?: string; filter?: string; edit?: string }>;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: Date;
  _count: {
    sales: number;
    customOrders: number;
  };
  salesValue: number;
  outstandingBalance: number;
  lastSaleDate: Date | null;
};

async function loadCustomers(query: string, filter: string) {
  try {
    const customers = await getDb().customer.findMany({
      where: {
        status: "active",
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { phone: { contains: query, mode: "insensitive" as const } },
                { email: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        createdAt: true,
        _count: {
          select: { sales: true, customOrders: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const customerIds = customers.map((customer) => customer.id);
    const [sales, payments] = customerIds.length
      ? await Promise.all([
          getDb().sale.findMany({
            where: {
              status: "active",
              customerId: { in: customerIds },
            },
            select: {
              id: true,
              customerId: true,
              grandTotal: true,
              saleDate: true,
            },
          }),
          getDb().salePayment.groupBy({
            by: ["saleId"],
            where: {
              status: "paid",
              sale: {
                status: "active",
                customerId: { in: customerIds },
              },
            },
            _sum: { amount: true },
          }),
        ])
      : [[], []];

    const paymentBySaleId = new Map(
      payments.map((payment) => [payment.saleId, Number(payment._sum.amount ?? 0)]),
    );

    const salesByCustomer = new Map<
      string,
      { salesValue: number; paidValue: number; lastSaleDate: Date | null }
    >();

    for (const sale of sales) {
      if (!sale.customerId) continue;
      const existing = salesByCustomer.get(sale.customerId) ?? {
        salesValue: 0,
        paidValue: 0,
        lastSaleDate: null,
      };
      existing.salesValue += Number(sale.grandTotal);
      existing.paidValue += paymentBySaleId.get(sale.id) ?? 0;
      if (!existing.lastSaleDate || sale.saleDate > existing.lastSaleDate) {
        existing.lastSaleDate = sale.saleDate;
      }
      salesByCustomer.set(sale.customerId, existing);
    }

    const enhanced = customers
      .map((customer) => {
        const salesSummary = salesByCustomer.get(customer.id);
        const salesValue = salesSummary?.salesValue ?? 0;
        const paidValue = salesSummary?.paidValue ?? 0;
        const outstandingBalance = Math.max(0, salesValue - paidValue);
        const lastSaleDate = salesSummary?.lastSaleDate ?? null;

        return {
          ...customer,
          salesValue,
          outstandingBalance,
          lastSaleDate,
        };
      })
      .filter((customer) => {
        if (filter === "outstanding") return customer.outstandingBalance > 0;
        if (filter === "orders") return customer._count.customOrders > 0;
        return true;
      });

    return { customers: enhanced, databaseError: false };
  } catch {
    return { customers: [] as CustomerRow[], databaseError: true };
  }
}

const loadCustomersCached = unstable_cache(
  async (query: string, filter: string) => loadCustomers(query, filter),
  ["customers-data"],
  {
    revalidate: 30,
    tags: [dataCacheTags.customers, dataCacheTags.sales],
  },
);

function CustomersContentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded-full bg-muted" />
              <div className="h-8 w-24 rounded-xl bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function customersHref({
  query,
  filter,
  edit,
}: {
  query?: string;
  filter?: string;
  edit?: string;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter && filter !== "all") params.set("filter", filter);
  if (edit) params.set("edit", edit);
  const value = params.toString();
  return value ? `/customers?${value}` : "/customers";
}

async function CustomersContent({
  query,
  selectedFilter,
  selectedEditId,
  preferMobileCards,
}: {
  query: string;
  selectedFilter: string;
  selectedEditId: string;
  preferMobileCards: boolean;
}) {
  const cachedData = await loadCustomersCached(query, selectedFilter);
  const customers = cachedData.customers.map((customer) => ({
    ...customer,
    createdAt: new Date(customer.createdAt),
    lastSaleDate: customer.lastSaleDate ? new Date(customer.lastSaleDate) : null,
  }));
  const { databaseError } = cachedData;
  const lifetimeSales = customers.reduce((total, customer) => total + customer.salesValue, 0);
  const outstandingTotal = customers.reduce((total, customer) => total + customer.outstandingBalance, 0);
  const customersWithOrders = customers.filter((customer) => customer._count.customOrders > 0).length;
  const selectedCustomer = customers.find((customer) => customer.id === selectedEditId) ?? null;

  return (
    <>
      {databaseError && <DatabaseUnavailableAlert scope="Customers" />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Displayed customers" value={customers.length} helper="Current filter result" />
        <StatCard icon={ShoppingBag} label="With custom orders" value={customersWithOrders} helper="Customers with bespoke work" />
        <StatCard icon={IndianRupee} label="Sales value" value={formatCurrency(lifetimeSales)} helper="Active linked sales only" />
        <StatCard icon={IndianRupee} label="Outstanding" value={formatCurrency(outstandingTotal)} helper="Uncollected sale balance" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add customer
            </CardTitle>
            <CardDescription>Only a customer name is required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createCustomer} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Customer name</Label>
                <Input id="customer-name" name="name" required minLength={2} maxLength={120} placeholder="Ananya Sharma" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone</Label>
                <Input id="customer-phone" name="phone" type="tel" maxLength={20} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Email</Label>
                <Input id="customer-email" name="email" type="email" maxLength={180} placeholder="customer@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-address">Address</Label>
                <Input id="customer-address" name="address" maxLength={500} placeholder="City, state, postal code" />
              </div>
              <Button type="submit" disabled={databaseError} className="w-full">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Save customer
              </Button>
            </form>
          </CardContent>
        </Card>

        <DataTable
          title="Customer directory"
          description={`${customers.length} matching active profiles.`}
          toolbar={
            <form method="get" className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input name="q" defaultValue={query} placeholder="Search name, phone, or email" className="pl-9" />
              </div>
              <select
                name="filter"
                defaultValue={selectedFilter}
                className="flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-ring/20"
              >
                <option value="all">All customers</option>
                <option value="outstanding">With outstanding balance</option>
                <option value="orders">With custom orders</option>
              </select>
              <div className="flex gap-2">
                <Button type="submit" variant="outline">Apply</Button>
                {(query || selectedFilter !== "all") ? (
                  <Link href="/customers" className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-medium hover:bg-muted">
                    Clear
                  </Link>
                ) : null}
              </div>
            </form>
          }
          columns={[
            {
              header: "Customer",
              render: (customer) => (
                <>
                  <span className="font-medium">{customer.name}</span>
                  {customer.address ? (
                    <span className="mt-1 flex max-w-56 items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {customer.address}
                    </span>
                  ) : null}
                </>
              ),
            },
            {
              header: "Contact",
              render: (customer) => (
                <>
                  {customer.phone ? (
                    <span className="flex items-center gap-1 text-xs">
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      {customer.phone}
                    </span>
                  ) : null}
                  {customer.email ? (
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" aria-hidden="true" />
                      {customer.email}
                    </span>
                  ) : null}
                  {!customer.phone && !customer.email ? <span className="text-xs text-muted-foreground">Not provided</span> : null}
                </>
              ),
            },
            {
              header: "Purchase history",
              render: (customer) => (
                <>
                  <span className="block font-medium">{customer._count.sales} sales</span>
                  <span className="text-xs text-muted-foreground">
                    {customer.lastSaleDate ? `Last sale ${formatDate(customer.lastSaleDate)}` : "No completed sales"}
                  </span>
                </>
              ),
            },
            {
              header: "Outstanding",
              className: "text-right",
              render: (customer) => (
                <div className="text-right">
                  <span className="block font-medium">{formatCurrency(customer.outstandingBalance)}</span>
                  {customer.outstandingBalance > 0 ? <StatusBadge tone="partial" label="Due" className="mt-2" /> : <StatusBadge tone="paid" className="mt-2" />}
                </div>
              ),
            },
            {
              header: "Added",
              render: (customer) => formatDate(customer.createdAt),
            },
            {
              header: "Actions",
              className: "text-right",
              render: (customer) => (
                <div className="flex justify-end gap-1">
                  <Link
                    href={customersHref({ query, filter: selectedFilter, edit: customer.id })}
                    className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-muted"
                  >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Edit {customer.name}</span>
                  </Link>
                  <form action={archiveCustomer}>
                    <input type="hidden" name="customerId" value={customer.id} />
                    <Button type="submit" variant="ghost" size="icon" title={`Archive ${customer.name}`}>
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Archive {customer.name}</span>
                    </Button>
                  </form>
                </div>
              ),
            },
          ]}
          rows={customers}
          getRowKey={(customer) => customer.id}
          preferMobileCards={preferMobileCards}
          pageSize={12}
          renderMobileCard={(customer) => (
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  {customer.address ? <p className="mt-1 text-xs text-muted-foreground">{customer.address}</p> : null}
                </div>
                {customer.outstandingBalance > 0 ? <StatusBadge tone="partial" label="Due" /> : <StatusBadge tone="paid" />}
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex flex-wrap gap-3 text-muted-foreground">
                  {customer.phone ? <span>{customer.phone}</span> : null}
                  {customer.email ? <span>{customer.email}</span> : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">Sales value</p>
                    <p className="font-medium">{formatCurrency(customer.salesValue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Outstanding</p>
                    <p className="font-medium">{formatCurrency(customer.outstandingBalance)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">Purchase history</p>
                    <p className="font-medium">{customer._count.sales} sales</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Custom orders</p>
                    <p className="font-medium">{customer._count.customOrders}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          empty={{
            icon: Users,
            title: query || selectedFilter !== "all" ? "No customers match these filters" : "No customer profiles yet",
            description: query || selectedFilter !== "all" ? "Try a broader search or remove the customer filter." : "Add the first customer profile to start linking sales and custom orders.",
          }}
        />
      </div>

      <Alert>
        Customer totals include active sales linked to the displayed customers. Archived profiles remain attached to historical records.
      </Alert>

      {selectedCustomer ? (
        <>
          <div className="fixed inset-0 z-20 bg-black/30" />
          <div className="fixed left-1/2 top-1/2 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-base font-semibold">Edit customer</h2>
              <p className="mt-1 text-sm text-muted-foreground">Update contact information for {selectedCustomer.name}.</p>
            </div>
            <form action={updateCustomer} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="customerId" value={selectedCustomer.id} />
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="selected-customer-name">Customer name</Label>
                <Input id="selected-customer-name" name="name" defaultValue={selectedCustomer.name} required minLength={2} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selected-customer-phone">Phone</Label>
                <Input id="selected-customer-phone" name="phone" type="tel" defaultValue={selectedCustomer.phone ?? ""} maxLength={20} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selected-customer-email">Email</Label>
                <Input id="selected-customer-email" name="email" type="email" defaultValue={selectedCustomer.email ?? ""} maxLength={180} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="selected-customer-address">Address</Label>
                <Input id="selected-customer-address" name="address" defaultValue={selectedCustomer.address ?? ""} maxLength={500} />
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Link
                  href={customersHref({ query, filter: selectedFilter })}
                  className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </Link>
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </>
  );
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  await requireCapability("customers");
  const [params, preferMobileCards] = await Promise.all([searchParams, isMobileRequest()]);
  const query = params.q?.trim() ?? "";
  const selectedFilter = params.filter?.trim() ?? "all";
  const selectedEditId = params.edit?.trim() ?? "";

  return (
    <section className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer profiles, purchase history, contact details, and outstanding receivables with archive-safe history."
        badge={<StatusBadge tone="archived" label="History preserved" />}
      />

      {params.success && <Alert variant="success">{params.success}</Alert>}
      {params.error && <Alert variant="destructive">{params.error}</Alert>}

      <Suspense fallback={<CustomersContentLoading />}>
        <CustomersContent
          query={query}
          selectedFilter={selectedFilter}
          selectedEditId={selectedEditId}
          preferMobileCards={preferMobileCards}
        />
      </Suspense>
    </section>
  );
}
