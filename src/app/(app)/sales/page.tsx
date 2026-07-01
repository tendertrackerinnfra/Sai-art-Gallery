import { unstable_cache } from "next/cache";
import { AlertCircle, Ban, CircleDollarSign, Download, PackageCheck, Receipt, Wallet } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCapability } from "@/lib/auth";
import { dataCacheTags } from "@/lib/data-cache";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

import { cancelSale, createSale, recordSalePayment } from "./actions";

type SalesPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const saleItemSlots = [1, 2, 3, 4, 5] as const;

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
] as const;

async function loadSalesData() {
  try {
    const [customers, products, sales] = await Promise.all([
      getDb().customer.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
      }),
      getDb().product.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          sku: true,
          name: true,
          sellingPrice: true,
          quantityOnHand: true,
        },
      }),
      getDb().sale.findMany({
        include: {
          customer: true,
          items: {
            include: {
              product: {
                select: {
                  sku: true,
                  name: true,
                },
              },
            },
          },
          payments: {
            where: { status: "paid" },
            orderBy: { paymentDate: "desc" },
          },
        },
        orderBy: { saleDate: "desc" },
        take: 20,
      }),
    ]);

    return { customers, products, sales, databaseError: false };
  } catch {
    return { customers: [], products: [], sales: [], databaseError: true };
  }
}

const loadSalesDataCached = unstable_cache(
  async () => loadSalesData(),
  ["sales-data"],
  {
    revalidate: 30,
    tags: [
      dataCacheTags.sales,
      dataCacheTags.customers,
      dataCacheTags.products,
      dataCacheTags.dashboard,
      dataCacheTags.finance,
    ],
  },
);

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requireCapability("sales");
  const [{ success, error }, cachedData] = await Promise.all([searchParams, loadSalesDataCached()]);
  const data = {
    ...cachedData,
    sales: cachedData.sales.map((sale) => ({
      ...sale,
      saleDate: new Date(sale.saleDate),
      payments: sale.payments.map((payment) => ({
        ...payment,
        paymentDate: new Date(payment.paymentDate),
      })),
    })),
  };

  const activeSales = data.sales.filter((sale) => sale.status === "active");
  const grossSalesValue = activeSales.reduce((total, sale) => total + Number(sale.grandTotal), 0);
  const amountCollected = activeSales.reduce(
    (total, sale) => total + sale.payments.reduce((saleTotal, payment) => saleTotal + Number(payment.amount), 0),
    0,
  );
  const outstandingBalance = Math.max(0, grossSalesValue - amountCollected);
  const unitsSold = activeSales.reduce(
    (total, sale) => total + sale.items.reduce((saleTotal, item) => saleTotal + item.quantity, 0),
    0,
  );

  const todayValue = activeSales
    .filter((sale) => sale.saleDate.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((total, sale) => total + Number(sale.grandTotal), 0);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Sales"
        description="Record jewellery sales, capture payment status, preserve stock deductions, and keep invoice-ready history."
        badge={<StatusBadge tone="active" label="Transactional stock control" />}
      />

      {data.databaseError && (
        <Alert variant="destructive">
          <strong>Database unavailable.</strong> Start PostgreSQL, connect Supabase, or restore the local database
          before using the sales workflow.
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}
      <Alert>
        Validation runs before saving. Product stock, duplicate items, discounts, and payment limits are checked on the server before the sale is committed.
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CircleDollarSign} label="Today&apos;s sales" value={formatCurrency(todayValue)} helper="Active sales dated today" />
        <StatCard icon={Wallet} label="Collected payments" value={formatCurrency(amountCollected)} helper="Paid amounts only" />
        <StatCard icon={Receipt} label="Outstanding balance" value={formatCurrency(outstandingBalance)} helper="Uncollected from active sales" />
        <StatCard icon={PackageCheck} label="Units sold" value={unitsSold} helper="Across visible active sales" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record sale</CardTitle>
          <CardDescription>
            Enter up to five finished products in one transaction. Stock is deducted only after the full sale passes validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSale} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="sale-customer">Customer</Label>
                <Select id="sale-customer" name="customerId" defaultValue="">
                  <option value="">Walk-in customer</option>
                  {data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-date">Sale date</Label>
                <Input id="sale-date" name="saleDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-discount">Additional discount</Label>
                <Input id="sale-discount" name="additionalDiscount" type="number" min="0" step="0.01" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-tax">Tax total</Label>
                <Input id="sale-tax" name="taxTotal" type="number" min="0" step="0.01" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-date">Payment date</Label>
                <Input id="payment-date" name="paymentDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-medium">Sale items</h2>
                <p className="text-sm text-muted-foreground">
                  Use one row per product. Enter the selling price you are charging for this sale.
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-28">Qty.</TableHead>
                      <TableHead className="w-32">Unit price</TableHead>
                      <TableHead className="w-32">Discount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleItemSlots.map((slot) => (
                      <TableRow key={slot}>
                        <TableCell className="font-medium text-muted-foreground">{slot}</TableCell>
                        <TableCell>
                          <Select name={`productId_${slot}`} defaultValue="">
                            <option value="">Select product</option>
                            {data.products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.sku} | {product.name} | Stock {product.quantityOnHand} | {formatCurrency(product.sellingPrice.toString())}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input name={`quantity_${slot}`} type="number" min="1" step="1" placeholder="0" />
                        </TableCell>
                        <TableCell>
                          <Input
                            name={`unitPrice_${slot}`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={data.products[0] ? "0.00" : "Price"}
                          />
                        </TableCell>
                        <TableCell>
                          <Input name={`discount_${slot}`} type="number" min="0" step="0.01" defaultValue="0" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="initial-payment">Initial payment</Label>
                <Input id="initial-payment" name="initialPayment" type="number" min="0" step="0.01" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment method</Label>
                <Select id="payment-method" name="paymentMethod" defaultValue="">
                  <option value="">No payment yet</option>
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="payment-reference">Payment reference</Label>
                <Input id="payment-reference" name="paymentReference" placeholder="UPI ref, bank ref, or note" />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-border/70 bg-muted/35 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Invoice preview</p>
                <p className="mt-2">A sale number and invoice-ready history are generated automatically after the sale is saved. This section is reserved for formatted invoice preview and print layout.</p>
              </div>
              <div className="rounded-2xl border border-dashed border-border p-4">
                <p className="text-sm font-medium">Invoice actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled aria-disabled="true">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Print invoice
                  </Button>
                  <Button type="button" variant="outline" disabled aria-disabled="true">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={data.databaseError || data.products.length === 0}>
              Save sale
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sales</CardTitle>
          <CardDescription>Active and cancelled sales stay visible so stock and payment history can be traced later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.sales.length === 0 ? (
            <EmptyState icon={Receipt} title="No sales recorded yet" description="Use the form above to create the first sale, deduct stock, and start the invoice-ready history." />
          ) : (
            data.sales.map((sale) => {
              const paidAmount = sale.payments.reduce((total, payment) => total + Number(payment.amount), 0);
              const balance = Math.max(0, Number(sale.grandTotal) - paidAmount);

              return (
                <Card key={sale.id} className="shadow-none">
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{sale.saleNumber}</CardTitle>
                        <CardDescription>
                          {sale.customer?.name ?? "Walk-in customer"} | {formatDate(sale.saleDate)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone={sale.status === "active" ? "active" : "cancelled"} />
                        <StatusBadge tone={sale.paymentStatus === "paid" ? "paid" : sale.paymentStatus === "partial" ? "partial" : sale.paymentStatus === "cancelled" ? "cancelled" : "pending"} label={sale.paymentStatus} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Subtotal</p>
                        <p className="mt-1 font-medium">{formatCurrency(sale.subtotal.toString())}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Grand total</p>
                        <p className="mt-1 font-medium">{formatCurrency(sale.grandTotal.toString())}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Collected</p>
                        <p className="mt-1 font-medium">{formatCurrency(paidAmount)}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="mt-1 font-medium">{formatCurrency(balance)}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Qty.</TableHead>
                            <TableHead className="text-right">Unit price</TableHead>
                            <TableHead className="text-right">Discount</TableHead>
                            <TableHead className="text-right">Line total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sale.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <span className="block font-medium">{item.product.name}</span>
                                <span className="font-mono text-xs text-muted-foreground">{item.product.sku}</span>
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unitPrice.toString())}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.discount.toString())}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(item.lineTotal.toString())}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <h3 className="text-sm font-medium">Payments</h3>
                        </div>
                        <p className="mb-3 text-xs text-muted-foreground">Invoice number: {sale.saleNumber}</p>
                        {sale.payments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {sale.payments.map((payment) => (
                              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                                <div>
                                  <p className="font-medium">{formatCurrency(payment.amount.toString())}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {payment.method.replaceAll("_", " ")}{payment.reference ? ` | ${payment.reference}` : ""}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground">{formatDate(payment.paymentDate)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-dashed border-border p-4">
                          <p className="text-sm font-medium">Invoice actions</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" disabled aria-disabled="true">
                              <Download className="h-4 w-4" aria-hidden="true" />
                              Print
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled aria-disabled="true">
                              <Download className="h-4 w-4" aria-hidden="true" />
                              Download
                            </Button>
                          </div>
                        </div>
                        {sale.status === "active" && balance > 0 ? (
                          <Card className="shadow-none">
                            <CardHeader>
                              <CardTitle className="text-sm">Record payment</CardTitle>
                              <CardDescription>Use this when the customer pays the remaining balance later.</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <form action={recordSalePayment} className="grid gap-3 sm:grid-cols-2">
                                <input type="hidden" name="saleId" value={sale.id} />
                                <div className="space-y-2">
                                  <Label htmlFor={`amount-${sale.id}`}>Amount</Label>
                                  <Input id={`amount-${sale.id}`} name="amount" type="number" min="0.01" step="0.01" required />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`method-${sale.id}`}>Method</Label>
                                  <Select id={`method-${sale.id}`} name="method" required defaultValue="">
                                    <option value="" disabled>Select method</option>
                                    {paymentMethodOptions.map((method) => (
                                      <option key={method.value} value={method.value}>
                                        {method.label}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`payment-date-${sale.id}`}>Payment date</Label>
                                  <Input
                                    id={`payment-date-${sale.id}`}
                                    name="paymentDate"
                                    type="date"
                                    required
                                    defaultValue={new Date().toISOString().slice(0, 10)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`reference-${sale.id}`}>Reference</Label>
                                  <Input id={`reference-${sale.id}`} name="reference" placeholder="UPI ref, bank ref, or note" />
                                </div>
                                <div className="sm:col-span-2">
                                  <Button type="submit" size="sm">
                                    Record payment
                                  </Button>
                                </div>
                              </form>
                            </CardContent>
                          </Card>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                            {sale.status === "cancelled"
                              ? "This sale is cancelled. No further payments can be recorded."
                              : "This sale is fully paid."}
                          </div>
                        )}

                        {sale.status === "active" ? (
                          <Card className="shadow-none">
                            <CardHeader>
                              <CardTitle className="text-sm">Cancel sale</CardTitle>
                              <CardDescription>
                                Cancellation restores stock. Sales with recorded payments must be handled outside this screen first.
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <form action={cancelSale} className="space-y-3">
                                <input type="hidden" name="saleId" value={sale.id} />
                                <div className="space-y-2">
                                  <Label htmlFor={`cancel-reason-${sale.id}`}>Reason</Label>
                                  <Input
                                    id={`cancel-reason-${sale.id}`}
                                    name="reason"
                                    minLength={5}
                                    required
                                    placeholder="Customer changed order"
                                  />
                                </div>
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="destructive"
                                  disabled={sale.payments.length > 0}
                                >
                                  <Ban className="h-4 w-4" aria-hidden="true" />
                                  Cancel sale
                                </Button>
                              </form>
                            </CardContent>
                          </Card>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>

      {data.products.some((product) => product.quantityOnHand <= 0) && (
        <Alert>
          <AlertCircle className="mb-1 h-4 w-4" aria-hidden="true" />
          Some finished products are out of stock. Sales for those items will be rejected until inventory is replenished.
        </Alert>
      )}
    </section>
  );
}
