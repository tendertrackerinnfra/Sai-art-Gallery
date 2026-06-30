import { AlertCircle, Ban, CircleDollarSign, PackageCheck, Receipt, Wallet } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

import { cancelSale, createSale, recordSalePayment } from "./actions";

export const dynamic = "force-dynamic";

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

function getPaymentBadgeClass(status: string) {
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "cancelled") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getRecordBadgeClass(status: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requireCapability("sales");
  const [{ success, error }, data] = await Promise.all([searchParams, loadSalesData()]);

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record jewellery sales, deduct finished stock, capture payments, and preserve the audit trail.
          </p>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700">Transactional stock control</Badge>
      </div>

      {data.databaseError && (
        <Alert variant="destructive">
          <strong>Database unavailable.</strong> Start PostgreSQL, connect Supabase, or restore the local database
          before using the sales workflow.
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Today&apos;s sales</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(todayValue)}</CardTitle>
            </div>
            <CircleDollarSign className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Collected payments</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(amountCollected)}</CardTitle>
            </div>
            <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Outstanding balance</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(outstandingBalance)}</CardTitle>
            </div>
            <Receipt className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Units sold</CardDescription>
              <CardTitle className="text-2xl">{unitsSold}</CardTitle>
            </div>
            <PackageCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
        </Card>
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
            <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              No sales recorded yet. Use the form above to create the first sale.
            </div>
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
                        <Badge className={getRecordBadgeClass(sale.status)}>{sale.status}</Badge>
                        <Badge className={getPaymentBadgeClass(sale.paymentStatus)}>{sale.paymentStatus}</Badge>
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
