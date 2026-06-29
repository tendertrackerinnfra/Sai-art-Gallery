"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";

const paymentMethods = new Set(["cash", "upi", "bank_transfer", "card", "other"]);

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function goToExpenses(type: "success" | "error", message: string): never {
  redirect(`/expenses?${type}=${encodeURIComponent(message)}`);
}

function readableError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return "An expense category with this name already exists.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "The request could not be completed.";
}

export async function createExpenseCategory(formData: FormData) {
  const currentUser = await requireCapability("expenses");
  const name = requiredText(formData, "name");
  if (name.length < 2 || name.length > 80) {
    goToExpenses("error", "Category name must be between 2 and 80 characters.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const category = await tx.expenseCategory.create({ data: { name } });
      await tx.auditLog.create({
        data: {
          action: "expense_category.created",
          entityType: "ExpenseCategory",
          entityId: category.id,
          userId: currentUser.id,
          newValue: { name },
        },
      });
    });
  } catch (error) {
    goToExpenses("error", readableError(error));
  }

  revalidatePath("/expenses");
  goToExpenses("success", "Expense category created.");
}

export async function archiveExpenseCategory(formData: FormData) {
  const currentUser = await requireCapability("expenses");
  const categoryId = requiredText(formData, "categoryId");
  if (!categoryId) {
    goToExpenses("error", "Expense category not found.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const category = await tx.expenseCategory.findFirst({
        where: { id: categoryId, status: "active" },
        include: {
          _count: {
            select: {
              expenses: { where: { status: "active" } },
            },
          },
        },
      });
      if (!category) {
        throw new Error("Expense category not found.");
      }
      if (category._count.expenses > 0) {
        throw new Error("Void or reclassify active expenses before archiving this category.");
      }

      await tx.expenseCategory.update({
        where: { id: categoryId },
        data: { status: "archived" },
      });
      await tx.auditLog.create({
        data: {
          action: "expense_category.archived",
          entityType: "ExpenseCategory",
          entityId: categoryId,
          userId: currentUser.id,
          oldValue: { status: "active" },
          newValue: { status: "archived" },
        },
      });
    });
  } catch (error) {
    goToExpenses("error", readableError(error));
  }

  revalidatePath("/expenses");
  goToExpenses("success", "Expense category archived.");
}

export async function createExpense(formData: FormData) {
  const currentUser = await requireCapability("expenses");
  const categoryId = requiredText(formData, "categoryId");
  const title = requiredText(formData, "title");
  const amountText = requiredText(formData, "amount");
  const method = requiredText(formData, "method");
  const expenseDateText = requiredText(formData, "expenseDate");
  const receiptPath = requiredText(formData, "receiptPath") || null;

  if (
    !categoryId ||
    title.length < 2 ||
    title.length > 160 ||
    !/^\d+(?:\.\d{1,2})?$/.test(amountText) ||
    Number(amountText) <= 0 ||
    !paymentMethods.has(method) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expenseDateText) ||
    Boolean(receiptPath && receiptPath.length > 1000)
  ) {
    goToExpenses("error", "Check the category, title, amount, date, and payment method.");
  }

  const expenseDate = new Date(`${expenseDateText}T00:00:00.000Z`);
  if (Number.isNaN(expenseDate.getTime())) {
    goToExpenses("error", "Enter a valid expense date.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const category = await tx.expenseCategory.findFirst({
        where: { id: categoryId, status: "active" },
      });
      if (!category) {
        throw new Error("Select an active expense category.");
      }

      const expense = await tx.expense.create({
        data: {
          categoryId,
          title,
          amount: amountText,
          method,
          expenseDate,
          receiptPath,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "expense.created",
          entityType: "Expense",
          entityId: expense.id,
          userId: currentUser.id,
          newValue: {
            categoryId,
            categoryName: category.name,
            title,
            amount: amountText,
            method,
            expenseDate: expenseDateText,
            receiptPath,
          },
        },
      });
    });
  } catch (error) {
    goToExpenses("error", readableError(error));
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  goToExpenses("success", "Expense recorded and added to the audit trail.");
}

export async function voidExpense(formData: FormData) {
  const currentUser = await requireCapability("expenses");
  const expenseId = requiredText(formData, "expenseId");
  const reason = requiredText(formData, "reason");
  if (!expenseId || reason.length < 5 || reason.length > 300) {
    goToExpenses("error", "Enter a void reason between 5 and 300 characters.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({
        where: { id: expenseId, status: "active" },
        include: { category: true },
      });
      if (!expense) {
        throw new Error("The selected expense is not active.");
      }

      await tx.expense.update({
        where: { id: expenseId },
        data: { status: "void" },
      });
      await tx.auditLog.create({
        data: {
          action: "expense.voided",
          entityType: "Expense",
          entityId: expenseId,
          userId: currentUser.id,
          oldValue: {
            status: "active",
            title: expense.title,
            amount: expense.amount.toString(),
            categoryName: expense.category.name,
          },
          newValue: { status: "void", reason },
        },
      });
    });
  } catch (error) {
    goToExpenses("error", readableError(error));
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  goToExpenses("success", "Expense voided. The original financial record was preserved.");
}
