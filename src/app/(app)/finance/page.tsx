import { Building2, CircleDollarSign, Landmark, PiggyBank, ReceiptText, Wallet } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

import { updateFinanceSettings } from "./actions";

export const dynamic = "force-dynamic";

type FinancePageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

type LedgerEntry = {
  id: string;
  date: Date;
  type: "income" | "expense";
  channel: "cash" | "bank" | "other";
  reference: string;
  counterparty: string;
  description: string;
  amount: number;
};

function settingValue(settings: Array<{ key: string; value: string }>, key: string) {
  return settings.find((setting) => setting.key === key)?.value ?? "";
}

function amountFromSetting(settings: Array<{ key: string; value: string }>, key: string) {
  const value = Number(settingValue(settings, key) || "0");
  return Number.isFinite(value) ? value : 0;
}

function financeChannel(method: string | null | undefined): "cash" | "bank" | "other" {
  if (method === "cash") return "cash";
  if (method === "upi" || method === "bank_transfer" || method === "card") return "bank";
  return "other";
}

async function loadFinanceData() {
  try {
    const [settings, salePayments, expenses, sales] = await Promise.all([
      getDb().setting.findMany({
        where: {
          key: {
            in: [
              "finance_bank_name",
              "finance_account_holder",
              "finance_account_number",
              "finance_ifsc_code",
              "finance_branch_name",
              "finance_opening_bank_balance",
              "finance_opening_cash_in_hand",
            ],
          },
        },
      }),
      getDb().salePayment.findMany({
        where: {
          status: "paid",
          sale: {
            status: "active",
          },
        },
        include: {
          sale: {
            include: {
              customer: true,
            },
          },
        },
        orderBy: { paymentDate: "desc" },
      }),
      getDb().expense.findMany({
        where: { status: "active" },
        include: { category: true },
        orderBy: { expenseDate: "desc" },
      }),
      getDb().sale.findMany({
        where: { status: "active" },
        select: {
          grandTotal: true,
          payments: {
            where: { status: "paid" },
            select: { amount: true },
          },
        },
      }),
    ]);

    return { settings, salePayments, expenses, sales, databaseError: false };
  } catch {
    return { settings: [], salePayments: [], expenses: [], sales: [], databaseError: true };
  }
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  await requireCapability("finance");
  const [{ success, error }, data] = await Promise.all([searchParams, loadFinanceData()]);

  const openingBankBalance = amountFromSetting(data.settings, "finance_opening_bank_balance");
  const openingCashInHand = amountFromSetting(data.settings, "finance_opening_cash_in_hand");

  const totalSalesValue = data.salePayments.reduce((total, payment) => total + Number(payment.amount), 0);
  const totalExpenses = data.expenses.reduce((total, expense) => total + Number(expense.amount), 0);

  const cashIncome = data.salePayments
    .filter((payment) => financeChannel(payment.method) === "cash")
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const bankIncome = data.salePayments
    .filter((payment) => financeChannel(payment.method) === "bank")
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const otherIncome = data.salePayments
    .filter((payment) => financeChannel(payment.method) === "other")
    .reduce((total, payment) => total + Number(payment.amount), 0);

  const cashExpenses = data.expenses
    .filter((expense) => financeChannel(expense.method) === "cash")
    .reduce((total, expense) => total + Number(expense.amount), 0);
  const bankExpenses = data.expenses
    .filter((expense) => financeChannel(expense.method) === "bank")
    .reduce((total, expense) => total + Number(expense.amount), 0);
  const otherExpenses = data.expenses
    .filter((expense) => financeChannel(expense.method) === "other")
    .reduce((total, expense) => total + Number(expense.amount), 0);

  const cashInHand = openingCashInHand + cashIncome - cashExpenses;
  const bankBalance = openingBankBalance + bankIncome - bankExpenses;
  const totalReceivable = data.sales.reduce((total, sale) => {
      const paid = sale.payments.reduce((saleTotal, payment) => saleTotal + Number(payment.amount), 0);
      return total + Math.max(0, Number(sale.grandTotal) - paid);
    }, 0);

  const ledger: LedgerEntry[] = [
    ...data.salePayments.map((payment) => ({
      id: payment.id,
      date: payment.paymentDate,
      type: "income" as const,
      channel: financeChannel(payment.method),
      reference: payment.sale.saleNumber,
      counterparty: payment.sale.customer?.name ?? "Walk-in customer",
      description: `Sale payment via ${payment.method.replaceAll("_", " ")}`,
      amount: Number(payment.amount),
    })),
    ...data.expenses.map((expense) => ({
      id: expense.id,
      date: expense.expenseDate,
      type: "expense" as const,
      channel: financeChannel(expense.method),
      reference: expense.category.name,
      counterparty: expense.title,
      description: `Expense via ${(expense.method ?? "other").replaceAll("_", " ")}`,
      amount: Number(expense.amount),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bank details, opening balances, income from sales, expense deductions, and live cash and bank positions.
          </p>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700">Auto-calculated from sales and expenses</Badge>
      </div>

      {data.databaseError && (
        <Alert variant="destructive">
          <strong>Database unavailable.</strong> Finance totals depend on sales payments, expenses, and saved settings.
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Total income</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(totalSalesValue)}</CardTitle>
            </div>
            <CircleDollarSign className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Total expenses</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(totalExpenses)}</CardTitle>
            </div>
            <ReceiptText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Cash in hand</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(cashInHand)}</CardTitle>
            </div>
            <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Bank balance</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(bankBalance)}</CardTitle>
            </div>
            <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Outstanding receivable</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(totalReceivable)}</CardTitle>
            </div>
            <PiggyBank className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Bank details and opening balances
            </CardTitle>
            <CardDescription>
              These are the only manual finance inputs. All later movement is derived automatically from sales payments and active expenses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateFinanceSettings} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bank-name">Bank name</Label>
                <Input id="bank-name" name="bankName" defaultValue={settingValue(data.settings, "finance_bank_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-holder">Account holder</Label>
                <Input id="account-holder" name="accountHolder" defaultValue={settingValue(data.settings, "finance_account_holder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-number">Account number</Label>
                <Input id="account-number" name="accountNumber" defaultValue={settingValue(data.settings, "finance_account_number")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifsc-code">IFSC code</Label>
                <Input id="ifsc-code" name="ifscCode" defaultValue={settingValue(data.settings, "finance_ifsc_code")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-name">Branch</Label>
                <Input id="branch-name" name="branchName" defaultValue={settingValue(data.settings, "finance_branch_name")} />
              </div>
              <div />
              <div className="space-y-2">
                <Label htmlFor="opening-bank">Opening bank balance</Label>
                <Input
                  id="opening-bank"
                  name="openingBankBalance"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={settingValue(data.settings, "finance_opening_bank_balance") || "0"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-cash">Opening cash in hand</Label>
                <Input
                  id="opening-cash"
                  name="openingCashInHand"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={settingValue(data.settings, "finance_opening_cash_in_hand") || "0"}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit">Save finance settings</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automatic balances</CardTitle>
            <CardDescription>Income is based on recorded sale payments. Expenses are based on active expense entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Cash income</p>
              <p className="mt-1 font-medium">{formatCurrency(cashIncome)}</p>
              <p className="mt-3 text-xs text-muted-foreground">Cash expenses</p>
              <p className="mt-1 font-medium">{formatCurrency(cashExpenses)}</p>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Bank income</p>
              <p className="mt-1 font-medium">{formatCurrency(bankIncome)}</p>
              <p className="mt-3 text-xs text-muted-foreground">Bank expenses</p>
              <p className="mt-1 font-medium">{formatCurrency(bankExpenses)}</p>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Unassigned income</p>
              <p className="mt-1 font-medium">{formatCurrency(otherIncome)}</p>
              <p className="mt-3 text-xs text-muted-foreground">Unassigned expenses</p>
              <p className="mt-1 font-medium">{formatCurrency(otherExpenses)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent finance ledger</CardTitle>
          <CardDescription>Combined view of sale payments and active expenses, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {ledger.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No finance transactions yet. Record a sale payment or an expense to start the ledger.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Party / Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={`${entry.type}-${entry.id}`}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      <Badge className={entry.type === "income" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{entry.channel}</TableCell>
                    <TableCell>{entry.reference}</TableCell>
                    <TableCell>{entry.counterparty}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell className={`text-right font-medium ${entry.type === "income" ? "text-emerald-700" : "text-red-700"}`}>
                      {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Alert>
        `Cash` changes cash in hand. `UPI`, `bank transfer`, and `card` change bank balance. `Other` stays visible in finance totals but is not added into cash or bank balance automatically.
      </Alert>
    </section>
  );
}
