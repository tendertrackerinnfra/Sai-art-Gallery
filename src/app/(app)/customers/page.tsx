import Link from "next/link";
import {
  Archive,
  IndianRupee,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  UserPlus,
  Users,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

import { archiveCustomer, createCustomer, updateCustomer } from "./actions";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  searchParams: Promise<{ success?: string; error?: string; q?: string }>;
};

async function loadCustomers(query: string) {
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
      include: {
        sales: {
          where: { status: "active" },
          select: { grandTotal: true },
        },
        _count: {
          select: { sales: true, customOrders: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { customers, databaseError: false };
  } catch {
    return { customers: [], databaseError: true };
  }
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  await requireCapability("customers");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const { customers, databaseError } = await loadCustomers(query);
  const lifetimeSales = customers.reduce(
    (total, customer) =>
      total +
      customer.sales.reduce((customerTotal, sale) => customerTotal + Number(sale.grandTotal), 0),
    0,
  );
  const customersWithOrders = customers.filter(
    (customer) => customer._count.customOrders > 0,
  ).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer profiles, contact details, sales value, and custom-order activity.
          </p>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700">History preserved</Badge>
      </div>

      {databaseError && (
        <Alert variant="destructive">
          <strong>Database unavailable.</strong> Check PostgreSQL and the configured migration.
        </Alert>
      )}
      {params.success && <Alert variant="success">{params.success}</Alert>}
      {params.error && <Alert variant="destructive">{params.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Displayed customers</CardDescription>
            <CardTitle className="text-2xl">{customers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>With custom orders</CardDescription>
            <CardTitle className="text-2xl">{customersWithOrders}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Displayed sales value</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(lifetimeSales)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
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
                <Input
                  id="customer-name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Ananya Sharma"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  name="phone"
                  type="tel"
                  maxLength={20}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  name="email"
                  type="email"
                  maxLength={180}
                  placeholder="customer@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-address">Address</Label>
                <Input
                  id="customer-address"
                  name="address"
                  maxLength={500}
                  placeholder="City, state, postal code"
                />
              </div>
              <Button type="submit" disabled={databaseError}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Save customer
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden="true" />
                Customer directory
              </CardTitle>
              <CardDescription className="mt-1.5">
                {customers.length} matching active profiles.
              </CardDescription>
            </div>
            <form method="get" className="flex w-full max-w-sm gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  name="q"
                  defaultValue={query}
                  placeholder="Search name, phone, or email"
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="outline">Search</Button>
              {query && (
                <Link
                  href="/customers"
                  className="inline-flex h-9 items-center justify-center rounded-md px-2 text-sm font-medium hover:bg-muted"
                >
                  Clear
                </Link>
              )}
            </form>
          </CardHeader>
          <CardContent className="p-0">
            {customers.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                {query ? "No customers match this search." : "No customer profiles yet."}
              </div>
            ) : (
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Sales value</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => {
                    const salesValue = customer.sales.reduce(
                      (total, sale) => total + Number(sale.grandTotal),
                      0,
                    );
                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <span className="font-medium">{customer.name}</span>
                          {customer.address && (
                            <span className="mt-1 flex max-w-56 items-center gap-1 truncate text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                              {customer.address}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
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
                          {!customer.phone && !customer.email && (
                            <span className="text-xs text-muted-foreground">Not provided</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(salesValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {customer._count.sales + customer._count.customOrders}
                        </TableCell>
                        <TableCell>{formatDate(customer.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <details className="group">
                              <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted">
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Edit {customer.name}</span>
                              </summary>
                              <div className="fixed inset-0 z-20 hidden bg-black/30 group-open:block" />
                              <div className="fixed left-1/2 top-1/2 z-30 hidden w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-6 shadow-xl group-open:block">
                                <div className="mb-4">
                                  <h2 className="text-base font-semibold">Edit customer</h2>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Update contact information for {customer.name}.
                                  </p>
                                </div>
                                <form action={updateCustomer} className="grid gap-4 sm:grid-cols-2">
                                  <input type="hidden" name="customerId" value={customer.id} />
                                  <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor={`name-${customer.id}`}>Customer name</Label>
                                    <Input
                                      id={`name-${customer.id}`}
                                      name="name"
                                      defaultValue={customer.name}
                                      required
                                      minLength={2}
                                      maxLength={120}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`phone-${customer.id}`}>Phone</Label>
                                    <Input
                                      id={`phone-${customer.id}`}
                                      name="phone"
                                      type="tel"
                                      defaultValue={customer.phone ?? ""}
                                      maxLength={20}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`email-${customer.id}`}>Email</Label>
                                    <Input
                                      id={`email-${customer.id}`}
                                      name="email"
                                      type="email"
                                      defaultValue={customer.email ?? ""}
                                      maxLength={180}
                                    />
                                  </div>
                                  <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor={`address-${customer.id}`}>Address</Label>
                                    <Input
                                      id={`address-${customer.id}`}
                                      name="address"
                                      defaultValue={customer.address ?? ""}
                                      maxLength={500}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2 sm:col-span-2">
                                    <Link
                                      href="/customers"
                                      className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-muted"
                                    >
                                      Cancel
                                    </Link>
                                    <Button type="submit">Save changes</Button>
                                  </div>
                                </form>
                              </div>
                            </details>
                            <form action={archiveCustomer}>
                              <input type="hidden" name="customerId" value={customer.id} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="icon"
                                title={`Archive ${customer.name}`}
                              >
                                <Archive className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Archive {customer.name}</span>
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4" aria-hidden="true" />
            Sales totals include active sales linked to the displayed customers.
          </span>
          <span>Archived profiles remain attached to all historical records.</span>
        </CardContent>
      </Card>
    </section>
  );
}
