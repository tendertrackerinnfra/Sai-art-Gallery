import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { Building2, CircleDollarSign, Download, Landmark, PiggyBank, ReceiptText, Wallet } from "lucide-react";

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

import { updateFinanceSettings } from "./actions";

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
    const [settings, incomeByMethod, expenseByMethod, activeSales, paidSaleTotals, saleLedger, expenseLedger] = await Promise.all([
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
      getDb().salePayment.groupBy({
        by: ["method"],
        where: {
          status: "paid",
          sale: {
            status: "active",
          },
        },
        _sum: { amount: true },
      }),
      getDb().expense.groupBy({
        by: ["method"],
        where: { status: "active" },
        _sum: { amount: true },
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
      getDb().salePayment.findMany({
        where: {
          status: "paid",
          sale: { status: "active" },
        },
        include: {
          sale: {
            select: {
              saleNumber: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { paymentDate: "desc" },
        take: 20,
      }),
      getDb().expense.findMany({
        where: { status: "active" },
        include: { category: true },
        orderBy: { expenseDate: "desc" },
        take: 20,
      }),
    ]);

    return { settings, incomeByMethod, expenseByMethod, activeSales, paidSaleTotals, saleLedger, expenseLedger, databaseError: false };
  } catch {
    return {
      settings: [] as Array<{ key: string; value: string }>,
      incomeByMethod: [],
      expenseByMethod: [],
      activeSales: [] as Array<{ id: string; grandTotal: unknown }>,
      paidSaleTotals: [],
      saleLedger: [],
      expenseLedger: [],
      databaseError: true,
    };
  }
}

const loadFinanceDataCached = unstable_cache(
  async () => loadFinanceData(),
  ["finance-data"],
  {
    revalidate: 30,
    tags: [dataCacheTags.finance, dataCacheTags.sales, dataCacheTags.expenses],
  },
);

function FinanceContentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded-full bg-muted" />
              <div className="h-8 w-28 rounded-xl bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 rounded-2xl bg-muted" />
            ))}
          </div>
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
  );
}

async function FinanceContent({ preferMobileCards }: { preferMobileCards: boolean }) {
  const cachedData = await loadFinanceDataCached();
  const data = {
    ...cachedData,
    saleLedger: cachedData.saleLedger.map((payment) => ({
      ...payment,
      paymentDate: new Date(payment.paymentDate),
    })),
    expenseLedger: cachedData.expenseLedger.map((expense) => ({
      ...expense,
      expenseDate: new Date(expense.expenseDate),
    })),
  };

  const openingBankBalance = amountFromSetting(data.settings, "finance_opening_bank_balance");
  const openingCashInHand = amountFromSetting(data.settings, "finance_opening_cash_in_hand");

  const incomeEntries = data.incomeByMethod.map((entry) => ({
    method: entry.method,
    amount: Number(entry._sum.amount ?? 0),
  }));
  const expenseEntries = data.expenseByMethod.map((entry) => ({
    method: entry.method,
    amount: Number(entry._sum.amount ?? 0),
  }));

  const totalSalesValue = incomeEntries.reduce((total, payment) => total + payment.amount, 0);
  const totalExpenses = expenseEntries.reduce((total, expense) => total + expense.amount, 0);

  const cashIncome = incomeEntries.filter((payment) => financeChannel(payment.method) === "cash").reduce((total, payment) => total + payment.amount, 0);
  const bankIncome = incomeEntries.filter((payment) => financeChannel(payment.method) === "bank").reduce((total, payment) => total + payment.amount, 0);
  const otherIncome = incomeEntries.filter((payment) => financeChannel(payment.method) === "other").reduce((total, payment) => total + payment.amount, 0);

  const cashExpenses = expenseEntries.filter((expense) => financeChannel(expense.method) === "cash").reduce((total, expense) => total + expense.amount, 0);
  const bankExpenses = expenseEntries.filter((expense) => financeChannel(expense.method) === "bank").reduce((total, expense) => total + expense.amount, 0);
  const otherExpenses = expenseEntries.filter((expense) => financeChannel(expense.method) === "other").reduce((total, expense) => total + expense.amount, 0);

  const cashInHand = openingCashInHand + cashIncome - cashExpenses;
  const bankBalance = openingBankBalance + bankIncome - bankExpenses;
  const paidBySaleId = new Map(
    data.paidSaleTotals.map((payment) => [payment.saleId, Number(payment._sum.amount ?? 0)]),
  );
  const totalReceivable = data.activeSales.reduce(
    (total, sale) => total + Math.max(0, Number(sale.grandTotal) - (paidBySaleId.get(sale.id) ?? 0)),
    0,
  );
  const netPosition = totalSalesValue - totalExpenses;

  const ledger: LedgerEntry[] = [
    ...data.saleLedger.map((payment) => ({
      id: payment.id,
      date: payment.paymentDate,
      type: "income" as const,
      channel: financeChannel(payment.method),
      reference: payment.sale.saleNumber,
      counterparty: payment.sale.customer?.name ?? "Walk-in customer",
      description: `Sale payment via ${payment.method.replaceAll("_", " ")}`,
      amount: Number(payment.amount),
    })),
    ...data.expenseLedger.map((expense) => ({
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
    <>
      {data.databaseError && <DatabaseUnavailableAlert scope="Finance" />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={CircleDollarSign} label="Total income" value={formatCurrency(totalSalesValue)} helper="Recorded sale payments" />
        <StatCard icon={ReceiptText} label="Total expenses" value={formatCurrency(totalExpenses)} helper="Active expense records" />
        <StatCard icon={Wallet} label="Cash in hand" value={formatCurrency(cashInHand)} helper="Cash sales minus cash expenses" />
        <StatCard icon={Landmark} label="Bank balance" value={formatCurrency(bankBalance)} helper="Bank-channel movements only" />
        <StatCard icon={PiggyBank} label="Receivables" value={formatCurrency(totalReceivable)} helper="Outstanding active sale balance" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
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
            <CardTitle>P&amp;L summary</CardTitle>
            <CardDescription>Automatic channel split and current net position.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Net position</span>
                <span className={`text-lg font-semibold ${netPosition >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCurrency(netPosition)}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
              <p className="text-xs text-muted-foreground">Cash split</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span>Income</span>
                <span className="font-medium">{formatCurrency(cashIncome)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>Expenses</span>
                <span className="font-medium">{formatCurrency(cashExpenses)}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
              <p className="text-xs text-muted-foreground">Bank split</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span>Income</span>
                <span className="font-medium">{formatCurrency(bankIncome)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>Expenses</span>
                <span className="font-medium">{formatCurrency(bankExpenses)}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
              <p className="text-xs text-muted-foreground">Unassigned channels</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span>Income</span>
                <span className="font-medium">{formatCurrency(otherIncome)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>Expenses</span>
                <span className="font-medium">{formatCurrency(otherExpenses)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        title="Recent finance ledger"
        description="Combined view of sale payments and active expenses, newest first."
        columns={[
          { header: "Date", render: (entry) => formatDate(entry.date) },
          { header: "Type", render: (entry) => <StatusBadge tone={entry.type === "income" ? "paid" : "voided"} label={entry.type} /> },
          { header: "Channel", render: (entry) => <span className="capitalize">{entry.channel}</span> },
          { header: "Reference", render: (entry) => entry.reference },
          { header: "Party / Title", render: (entry) => entry.counterparty },
          { header: "Description", render: (entry) => entry.description },
          {
            header: "Amount",
            className: "text-right",
            render: (entry) => (
              <span className={`font-medium ${entry.type === "income" ? "text-emerald-700" : "text-rose-700"}`}>
                {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.amount)}
              </span>
            ),
          },
        ]}
        rows={ledger}
        getRowKey={(entry) => `${entry.type}-${entry.id}`}
        preferMobileCards={preferMobileCards}
        pageSize={12}
        renderMobileCard={(entry) => (
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{entry.counterparty}</p>
                <p className="mt-1 text-xs text-muted-foreground">{entry.reference} - {formatDate(entry.date)}</p>
              </div>
              <StatusBadge tone={entry.type === "income" ? "paid" : "voided"} label={entry.type} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{entry.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="capitalize text-sm text-muted-foreground">{entry.channel}</span>
              <span className={`font-medium ${entry.type === "income" ? "text-emerald-700" : "text-rose-700"}`}>
                {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.amount)}
              </span>
            </div>
          </div>
        )}
        empty={{
          icon: Wallet,
          title: "No finance transactions yet",
          description: "Record a sale payment or an expense to start the finance ledger.",
        }}
      />

      <Alert>
        `Cash` changes cash in hand. `UPI`, `bank transfer`, and `card` change bank balance. `Other` stays visible in totals but is not automatically assigned to cash or bank.
      </Alert>
    </>
  );
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  await requireCapability("finance");
  const [{ success, error }, preferMobileCards] = await Promise.all([searchParams, isMobileRequest()]);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Finance"
        description="Live cash, bank, receivables, and expense intelligence derived automatically from saved business transactions."
        badge={<StatusBadge tone="active" label="Auto-calculated from sales and expenses" />}
        actions={
          <>
            <Button variant="outline" disabled aria-disabled="true">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export P&amp;L
            </Button>
            <Button variant="outline" disabled aria-disabled="true">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export ledger
            </Button>
          </>
        }
      />

      {success && <Alert variant="success">{success}</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}

      <Suspense fallback={<FinanceContentLoading />}>
        <FinanceContent preferMobileCards={preferMobileCards} />
      </Suspense>
    </section>
  );
}
