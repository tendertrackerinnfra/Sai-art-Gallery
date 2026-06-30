"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";

const financeSettingKeys = [
  "finance_bank_name",
  "finance_account_holder",
  "finance_account_number",
  "finance_ifsc_code",
  "finance_branch_name",
  "finance_opening_bank_balance",
  "finance_opening_cash_in_hand",
] as const;

type FinanceSettingKey = (typeof financeSettingKeys)[number];

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function goToFinance(type: "success" | "error", message: string): never {
  redirect(`/finance?${type}=${encodeURIComponent(message)}`);
}

function isMoney(value: string) {
  return /^\d+(?:\.\d{1,2})?$/.test(value);
}

export async function updateFinanceSettings(formData: FormData) {
  const currentUser = await requireCapability("finance");

  const values: Record<FinanceSettingKey, string> = {
    finance_bank_name: requiredText(formData, "bankName"),
    finance_account_holder: requiredText(formData, "accountHolder"),
    finance_account_number: requiredText(formData, "accountNumber"),
    finance_ifsc_code: requiredText(formData, "ifscCode").toUpperCase(),
    finance_branch_name: requiredText(formData, "branchName"),
    finance_opening_bank_balance: requiredText(formData, "openingBankBalance") || "0",
    finance_opening_cash_in_hand: requiredText(formData, "openingCashInHand") || "0",
  };

  if (values.finance_bank_name.length > 120) {
    goToFinance("error", "Bank name must be 120 characters or fewer.");
  }
  if (values.finance_account_holder.length > 120) {
    goToFinance("error", "Account holder must be 120 characters or fewer.");
  }
  if (values.finance_account_number && !/^[0-9A-Za-z\-\/ ]{6,40}$/.test(values.finance_account_number)) {
    goToFinance("error", "Enter a valid account number.");
  }
  if (values.finance_ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(values.finance_ifsc_code)) {
    goToFinance("error", "Enter a valid IFSC code.");
  }
  if (values.finance_branch_name.length > 120) {
    goToFinance("error", "Branch name must be 120 characters or fewer.");
  }
  if (!isMoney(values.finance_opening_bank_balance) || !isMoney(values.finance_opening_cash_in_hand)) {
    goToFinance("error", "Opening balances must be valid amounts.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      for (const [key, value] of Object.entries(values) as Array<[FinanceSettingKey, string]>) {
        await tx.setting.upsert({
          where: { key },
          update: { value },
          create: {
            key,
            value,
            description: key.replaceAll("_", " "),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "finance.settings_updated",
          entityType: "Setting",
          entityId: "finance",
          userId: currentUser.id,
          newValue: values,
        },
      });
    });
  } catch {
    goToFinance("error", "Finance settings could not be saved.");
  }

  revalidatePath("/finance");
  goToFinance("success", "Finance settings updated.");
}
