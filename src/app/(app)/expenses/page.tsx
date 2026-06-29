import Link from "next/link";
import {
  Archive,
  CalendarDays,
  ExternalLink,
  IndianRupee,
  Plus,
  ReceiptText,
  Tags,
  Undo2,
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
import { Select } from "@/components/ui/select";
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

import {
  archiveExpenseCategory,
  createExpense,
  createExpenseCategory,
  voidExpense,
} from "./actions";

export const dynamic = "force-dynamic";

type ExpensesPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    category?: string;
    month?: string;
  }>;
};

function monthRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

function currentMonth() {
  return dateKeyInIndia(new Date()).slice(0, 7);
}

function dateKeyInIndia(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
}

async function loadExpenses(month: string, categoryId: string) {
  const range = monthRange(month);
  try {
    const [categories, expenses] = await Promise.all([
      getDb().expenseCategory.findMany({
        where: { status: "active" },
        include: {
          _count: {
            select: {
              expenses: { where: { status: "active" } },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      getDb().expense.findMany({
        where: {
          ...(categoryId ? { categoryId } : {}),
          ...(range
            ? {
                expenseDate: {
                  gte: range.start,
                  lt: range.end,
                },
              }
            : {}),
        },
        include: { category: true },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
    ]);
    return { categories, expenses, databaseError: false };
  } catch {
    return { categories: [], expenses: [], databaseError: true };
  }
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requireCapability("expenses");
  const params = await searchParams;
  const selectedMonth = monthRange(params.month ?? "")
    ? (params.month as string)
    : currentMonth();
  const selectedCategory = params.category?.trim() ?? "";
  const { categories, expenses, databaseError } = await loadExpenses(
    selectedMonth,
    selectedCategory,
  );
  const activeExpenses = expenses.filter((expense) => expense.status === "active");
  const voidExpenses = expenses.filter((expense) => expense.status === "void");
  const totalExpenses = activeExpenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0,
  );
  const todayKey = dateKeyInIndia(new Date());
  const todayExpenses = activeExpenses
    .filter((expense) => dateKeyInIndia(expense.expenseDate) === todayKey)
    .reduce((total, expense) => total + Number(expense.amount), 0);
  const topCategory = categories
    .map((category) => ({
      name: category.name,
      total: activeExpenses
        .filter((expense) => expense.categoryId === category.id)
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
    }))
    .sort((a, b) => b.total - a.total)[0];
  const isHttpReceipt = (value: string | null) =>
    Boolean(value && /^https?:\/\//i.test(value));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record operating costs by category with payment details and permanent audit history.
          </p>
        </div>
        <Badge className="border-amber-200 bg-amber-50 text-amber-800">
          Void-only corrections
        </Badge>
      </div>

      {databaseError && (
        <Alert variant="destructive">
          <strong>Database unavailable.</strong> Check PostgreSQL and the configured migration.
        </Alert>
      )}
      {params.success && <Alert variant="success">{params.success}</Alert>}
      {params.error && <Alert variant="destructive">{params.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Selected month total</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalExpenses)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Today</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(todayExpenses)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active records</CardDescription>
            <CardTitle className="text-2xl">{activeExpenses.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Largest category</CardDescription>
            <CardTitle className="truncate text-lg">
              {topCategory?.total ? topCategory.name : "-"}
            </CardTitle>
            <CardDescription>
              {topCategory?.total ? formatCurrency(topCategory.total) : "No expenses"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4" aria-hidden="true" />
              Record expense
            </CardTitle>
            <CardDescription>
              Financial records cannot be deleted or directly edited after saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createExpense} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="expense-title">Expense title</Label>
                <Input
                  id="expense-title"
                  name="title"
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="Packaging supplies"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-category">Category</Label>
                <Select id="expense-category" name="categoryId" required defaultValue="">
                  <option value="" disabled>Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Amount</Label>
                <Input
                  id="expense-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-method">Payment method</Label>
                <Select id="expense-method" name="method" required defaultValue="">
                  <option value="" disabled>Select method</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-date">Expense date</Label>
                <Input
                  id="expense-date"
                  name="expenseDate"
                  type="date"
                  defaultValue={dateKeyInIndia(new Date())}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="expense-receipt">Receipt path or URL</Label>
                <Input
                  id="expense-receipt"
                  name="receiptPath"
                  maxLength={1000}
                  placeholder="Optional local path or secure cloud URL"
                />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <Button
                  type="submit"
                  disabled={databaseError || categories.length === 0}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Record expense
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" aria-hidden="true" />
              Categories
            </CardTitle>
            <CardDescription>Categories with active expenses cannot be archived.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createExpenseCategory} className="flex gap-2">
              <Input
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Marketing"
              />
              <Button type="submit" size="icon" title="Add expense category">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Add expense category</span>
              </Button>
            </form>
            <div className="divide-y rounded-md border">
              {categories.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Add the first expense category.
                </p>
              ) : (
                categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{category.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {category._count.expenses} active expenses
                      </span>
                    </span>
                    <form action={archiveExpenseCategory}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        disabled={category._count.expenses > 0}
                        title={`Archive ${category.name}`}
                      >
                        <Archive className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Archive {category.name}</span>
                      </Button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4 xl:flex xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Expense register
            </CardTitle>
            <CardDescription className="mt-1.5">
              {activeExpenses.length} active and {voidExpenses.length} void records in this view.
            </CardDescription>
          </div>
          <form method="get" className="grid w-full gap-2 sm:grid-cols-[160px_220px_auto] xl:w-auto">
            <Input
              name="month"
              type="month"
              defaultValue={selectedMonth}
              aria-label="Expense month"
            />
            <Select
              name="category"
              defaultValue={selectedCategory}
              aria-label="Expense category filter"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button type="submit" variant="outline">Apply</Button>
              {(selectedCategory || selectedMonth !== currentMonth()) && (
                <Link
                  href="/expenses"
                  className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-muted"
                >
                  Reset
                </Link>
              )}
            </div>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No expenses match the selected month and category.
            </div>
          ) : (
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date / Expense</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-16">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id} className={expense.status === "void" ? "opacity-60" : ""}>
                    <TableCell>
                      <span className="block font-medium">{expense.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(expense.expenseDate)}
                      </span>
                    </TableCell>
                    <TableCell>{expense.category.name}</TableCell>
                    <TableCell className="capitalize">
                      {expense.method?.replaceAll("_", " ") ?? "-"}
                    </TableCell>
                    <TableCell>
                      {expense.receiptPath ? (
                        isHttpReceipt(expense.receiptPath) ? (
                          <a
                            href={expense.receiptPath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            Open
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span
                            className="block max-w-36 truncate text-xs text-muted-foreground"
                            title={expense.receiptPath}
                          >
                            {expense.receiptPath}
                          </span>
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {expense.status === "active" ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="border-red-200 bg-red-50 text-red-700">Void</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount.toString())}
                    </TableCell>
                    <TableCell>
                      {expense.status === "active" && (
                        <details className="group">
                          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted">
                            <Undo2 className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Void {expense.title}</span>
                          </summary>
                          <div className="fixed inset-0 z-20 hidden bg-black/30 group-open:block" />
                          <div className="fixed left-1/2 top-1/2 z-30 hidden w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-6 shadow-xl group-open:block">
                            <h2 className="text-base font-semibold">Void expense</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              This preserves the original record and excludes it from active totals.
                            </p>
                            <form action={voidExpense} className="mt-5 space-y-4">
                              <input type="hidden" name="expenseId" value={expense.id} />
                              <div className="space-y-2">
                                <Label htmlFor={`void-reason-${expense.id}`}>Reason</Label>
                                <Input
                                  id={`void-reason-${expense.id}`}
                                  name="reason"
                                  required
                                  minLength={5}
                                  maxLength={300}
                                  placeholder="Duplicate entry"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Link
                                  href="/expenses"
                                  className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-muted"
                                >
                                  Cancel
                                </Link>
                                <Button type="submit" variant="destructive">
                                  Void expense
                                </Button>
                              </div>
                            </form>
                          </div>
                        </details>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Alert>
        Every expense creation and void action writes an audit log. Receipt paths are references;
        persistent online file upload will be added with managed object storage.
      </Alert>
    </section>
  );
}
