"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCapability } from "@/lib/auth";
import { dataCacheTags, revalidateAppData } from "@/lib/data-cache";
import { getDb } from "@/lib/db";

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  return requiredText(formData, key) || null;
}

function goToCustomers(type: "success" | "error", message: string): never {
  redirect(`/customers?${type}=${encodeURIComponent(message)}`);
}

function validateCustomer({
  name,
  phone,
  email,
  address,
}: {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}) {
  if (name.length < 2 || name.length > 120) {
    return "Customer name must be between 2 and 120 characters.";
  }
  if (phone && (!/^[0-9+\-()\s]{7,20}$/.test(phone) || phone.length > 20)) {
    return "Enter a valid phone number.";
  }
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180)) {
    return "Enter a valid email address.";
  }
  if (address && address.length > 500) {
    return "Address must be 500 characters or fewer.";
  }
  return null;
}

export async function createCustomer(formData: FormData) {
  const currentUser = await requireCapability("customers");
  const customerData = {
    name: requiredText(formData, "name"),
    phone: optionalText(formData, "phone"),
    email: optionalText(formData, "email")?.toLowerCase() ?? null,
    address: optionalText(formData, "address"),
  };
  const validationError = validateCustomer(customerData);
  if (validationError) {
    goToCustomers("error", validationError);
  }

  try {
    await getDb().$transaction(async (tx) => {
      const customer = await tx.customer.create({ data: customerData });
      await tx.auditLog.create({
        data: {
          action: "customer.created",
          entityType: "Customer",
          entityId: customer.id,
          userId: currentUser.id,
          newValue: customerData,
        },
      });
    });
  } catch {
    goToCustomers("error", "The customer could not be created.");
  }

  revalidatePath("/customers");
  revalidateAppData(dataCacheTags.customers);
  goToCustomers("success", "Customer profile created.");
}

export async function updateCustomer(formData: FormData) {
  const currentUser = await requireCapability("customers");
  const customerId = requiredText(formData, "customerId");
  const customerData = {
    name: requiredText(formData, "name"),
    phone: optionalText(formData, "phone"),
    email: optionalText(formData, "email")?.toLowerCase() ?? null,
    address: optionalText(formData, "address"),
  };
  const validationError = validateCustomer(customerData);
  if (!customerId || validationError) {
    goToCustomers("error", validationError ?? "Customer not found.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({
        where: { id: customerId, status: "active" },
      });
      if (!existing) {
        throw new Error("Customer not found.");
      }

      await tx.customer.update({
        where: { id: customerId },
        data: customerData,
      });
      await tx.auditLog.create({
        data: {
          action: "customer.updated",
          entityType: "Customer",
          entityId: customerId,
          userId: currentUser.id,
          oldValue: {
            name: existing.name,
            phone: existing.phone,
            email: existing.email,
            address: existing.address,
          },
          newValue: customerData,
        },
      });
    });
  } catch {
    goToCustomers("error", "The customer could not be updated.");
  }

  revalidatePath("/customers");
  revalidateAppData(dataCacheTags.customers);
  goToCustomers("success", "Customer profile updated.");
}

export async function archiveCustomer(formData: FormData) {
  const currentUser = await requireCapability("customers");
  const customerId = requiredText(formData, "customerId");
  if (!customerId) {
    goToCustomers("error", "Customer not found.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, status: "active" },
      });
      if (!customer) {
        throw new Error("Customer not found.");
      }

      await tx.customer.update({
        where: { id: customerId },
        data: { status: "archived" },
      });
      await tx.auditLog.create({
        data: {
          action: "customer.archived",
          entityType: "Customer",
          entityId: customerId,
          userId: currentUser.id,
          oldValue: { status: "active" },
          newValue: { status: "archived" },
        },
      });
    });
  } catch {
    goToCustomers("error", "The customer could not be archived.");
  }

  revalidatePath("/customers");
  revalidateAppData(dataCacheTags.customers);
  goToCustomers("success", "Customer archived. Sales and order history were preserved.");
}
