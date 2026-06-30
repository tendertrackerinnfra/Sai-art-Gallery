import Link from "next/link";
import { Archive, CalendarDays, ExternalLink, IndianRupee, Plus, ReceiptText, Tags, Undo2, Wallet } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
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
import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

import { archiveExpenseCategory, createExpense, createExpenseCategory, voidExpense } from "./actions";

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
  const selectedMonth = monthRange(params.month ?? "") ? (params.month as string) : currentMonth();
  const selectedCategory = params.category?.trim() ?? "";
  const { categories, expenses, databaseError } = await loadExpenses(selectedMonth, selectedCategory);
  const activeExpenses = expenses.filter((expense) => expense.status === "active");
  const voidExpenses = expenses.filter((expense) => expense.status === "void");
  const totalExpenses = activeExpenses.reduce((total, expense) => total + Number(expense.amount), 0);
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
  const isHttpReceipt = (value: string | null) => Boolean(value && /^https?:\/\//i.test(value));

  return (
    <section className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Record operating costs by category with payment details, receipt references, monthly filters, and void-only correction rules."
        badge={<StatusBadge tone="voided" label="Void-only corrections" />}
      />

      {databaseError && (
        <Alert variant="destructive">
          <strong>Database unavailable.</strong> Check PostgreSQL and the configured migration.
        </Alert>
      )}
      {params.success && <Alert variant="success">{params.success}</Alert>}
      {params.error && <Alert variant="destructive">{params.error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} label="Selected month total" value={formatCurrency(totalExpenses)} helper="Active expenses only" />
        <StatCard icon={Wallet} label="Today" value={formatCurrency(todayExpenses)} helper="Today in India timezone" />
        <StatCard icon={ReceiptText} label="Active records" value={activeExpenses.length} helper={`${voidExpenses.length} void records preserved`} />
        <StatCard icon={Tags} label="Largest category" value={topCategory?.name ?? "-"} helper={topCategory?.total ? formatCurrency(topCategory.total) : "No expenses"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4" aria-hidden="true" />
              Record expense
            </CardTitle>
            <CardDescription>Financial records cannot be deleted or directly edited after saving.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createExpense} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="expense-title">Expense title</Label>
                <Input id="expense-title" name="title" required minLength={2} maxLength={160} placeholder="Packaging supplies" />
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
                <Input id="expense-amount" name="amount" type="number" min="0.01" step="0.01" required />
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
                <Input id="expense-date" name="expenseDate" type="date" defaultValue={dateKeyInIndia(new Date())} required />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="expense-receipt">Receipt path or URL</Label>
                <Input id="expense-receipt" name="receiptPath" maxLength={1000} placeholder="Optional local path or secure cloud URL" />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={databaseError || categories.length === 0}>
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
              Category management
            </CardTitle>
            <CardDescription>Categories with active expenses cannot be archived.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createExpenseCategory} className="flex gap-2">
              <Input name="name" required minLength={2} maxLength={80} placeholder="Marketing" />
              <Button type="submit" size="icon" title="Add expense category">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Add expense category</span>
              </Button>
            </form>
            <div className="space-y-2">
              {categories.length === 0 ? (
                <EmptyState icon={Tags} title="No expense categories" description="Add the first expense category to start classifying operating costs." />
              ) : (
                categories.map((category) => (
                  <div key={category.id} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{category.name}</span>
                      <span className="text-xs text-muted-foreground">{category._count.expenses} active expenses</span>
                    </span>
                    <form action={archiveExpenseCategory}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <Button type="submit" variant="ghost" size="icon" disabled={category._count.expenses > 0} title={`Archive ${category.name}`}>
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

      <DataTable
        title="Expense register"
        description={`${activeExpenses.length} active and ${voidExpenses.length} void records in this view.`}
        toolbar={
          <form method="get" className="grid gap-2 sm:grid-cols-[160px_220px_auto]">
            <Input name="month" type="month" defaultValue={selectedMonth} aria-label="Expense month" />
            <Select name="category" defaultValue={selectedCategory} aria-label="Expense category filter">
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Apply
              </Button>
              {(selectedCategory || selectedMonth !== currentMonth()) ? (
                <Link href="/expenses" className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-medium hover:bg-muted">
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        }
        columns={[
          {
            header: "Expense",
            render: (expense) => (
              <>
                <span className="block font-medium">{expense.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(expense.expenseDate)}</span>
              </>
            ),
          },
          {
            header: "Category",
            render: (expense) => expense.category.name,
          },
          {
            header: "Method",
            render: (expense) => <span className="capitalize">{expense.method?.replaceAll("_", " ") ?? "-"}</span>,
          },
          {
            header: "Receipt",
            render: (expense) =>
              expense.receiptPath ? (
                isHttpReceipt(expense.receiptPath) ? (
                  <a href={expense.receiptPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Open
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="block max-w-36 truncate text-xs text-muted-foreground" title={expense.receiptPath}>
                    {expense.receiptPath}
                  </span>
                )
              ) : (
                "-"
              ),
          },
          {
            header: "Status",
            render: (expense) => (expense.status === "active" ? <StatusBadge tone="active" /> : <StatusBadge tone="voided" />),
          },
          {
            header: "Amount",
            className: "text-right",
            render: (expense) => <span className="font-medium">{formatCurrency(expense.amount.toString())}</span>,
          },
          {
            header: "Actions",
            className: "text-right",
            render: (expense) =>
              expense.status === "active" ? (
                <details className="group">
                  <summary className="ml-auto flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl hover:bg-muted">
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Void {expense.title}</span>
                  </summary>
                  <div className="fixed inset-0 z-20 hidden bg-black/30 group-open:block" />
                  <div className="fixed left-1/2 top-1/2 z-30 hidden w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl group-open:block">
                    <h2 className="text-base font-semibold">Void expense</h2>
                    <p className="mt-1 text-sm text-muted-foreground">This preserves the original record and excludes it from active totals.</p>
                    <form action={voidExpense} className="mt-5 space-y-4">
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <div className="space-y-2">
                        <Label htmlFor={`void-reason-${expense.id}`}>Reason</Label>
                        <Input id={`void-reason-${expense.id}`} name="reason" required minLength={5} maxLength={300} placeholder="Duplicate entry" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Link href="/expenses" className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-medium hover:bg-muted">
                          Cancel
                        </Link>
                        <Button type="submit" variant="destructive">Void expense</Button>
                      </div>
                    </form>
                  </div>
                </details>
              ) : (
                <span className="text-xs text-muted-foreground">Voided</span>
              ),
          },
        ]}
        rows={expenses}
        getRowKey={(expense) => expense.id}
        renderMobileCard={(expense) => (
          <div className={`rounded-2xl border border-border/70 bg-card p-4 shadow-sm ${expense.status === "void" ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{expense.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(expense.expenseDate)} · {expense.category.name}</p>
              </div>
              {expense.status === "active" ? <StatusBadge tone="active" /> : <StatusBadge tone="voided" />}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Method</p>
                <p className="font-medium capitalize">{expense.method?.replaceAll("_", " ") ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-medium">{formatCurrency(expense.amount.toString())}</p>
              </div>
            </div>
            {expense.receiptPath ? (
              <div className="mt-3 text-xs text-muted-foreground">
                {isHttpReceipt(expense.receiptPath) ? (
                  <a href={expense.receiptPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Open receipt
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="block truncate" title={expense.receiptPath}>{expense.receiptPath}</span>
                )}
              </div>
            ) : null}
          </div>
        )}
        empty={{
          icon: ReceiptText,
          title: "No expenses match the selected view",
          description: "Adjust the month or category filter, or record a new expense above.",
        }}
        desktopMinWidthClassName="min-w-[860px]"
      />

      <Alert>
        Every expense creation and void action writes an audit log. Receipt paths are references; persistent online file upload will be added later without changing current financial rules.
      </Alert>
    </section>
  );
}
