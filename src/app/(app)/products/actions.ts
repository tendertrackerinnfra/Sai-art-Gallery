"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { requireCapability } from "@/lib/auth";

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function goToProducts(type: "success" | "error", message: string): never {
  redirect(`/products?${type}=${encodeURIComponent(message)}`);
}

function readableError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return "A record with this name or SKU already exists.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "The request could not be completed.";
}

export async function createCategory(formData: FormData) {
  await requireCapability("products");
  const name = requiredText(formData, "name");
  const skuPrefix = requiredText(formData, "skuPrefix").toUpperCase();

  if (name.length < 2 || !/^[A-Z]{3}$/.test(skuPrefix)) {
    goToProducts("error", "Enter a category name and a three-letter SKU prefix.");
  }

  try {
    await getDb().productCategory.create({
      data: { name, skuPrefix },
    });
  } catch (error) {
    goToProducts("error", readableError(error));
  }

  revalidatePath("/products");
  goToProducts("success", "Category created.");
}

export async function createProduct(formData: FormData) {
  const currentUser = await requireCapability("products");
  const name = requiredText(formData, "name");
  const categoryId = requiredText(formData, "categoryId");
  const sellingPrice = Number(requiredText(formData, "sellingPrice"));
  const costPriceText = requiredText(formData, "costPrice");
  const costPrice = costPriceText ? Number(costPriceText) : null;
  const openingStock = Number(requiredText(formData, "openingStock") || "0");
  const reorderLevel = Number(requiredText(formData, "reorderLevel") || "0");

  if (
    name.length < 2 ||
    !categoryId ||
    !Number.isFinite(sellingPrice) ||
    sellingPrice < 0 ||
    (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) ||
    !Number.isInteger(openingStock) ||
    openingStock < 0 ||
    !Number.isInteger(reorderLevel) ||
    reorderLevel < 0
  ) {
    goToProducts("error", "Check the product name, prices, and stock quantities.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const category = await tx.productCategory.findFirst({
        where: { id: categoryId, status: "active" },
      });

      if (!category) {
        throw new Error("Select an active product category.");
      }

      const products = await tx.product.findMany({
        where: { sku: { startsWith: `SAG-${category.skuPrefix}-` } },
        select: { sku: true },
      });
      const nextNumber =
        products.reduce((highest, product) => {
          const sequence = Number(product.sku.split("-").at(-1));
          return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
        }, 0) + 1;
      const sku = `SAG-${category.skuPrefix}-${String(nextNumber).padStart(4, "0")}`;

      const product = await tx.product.create({
        data: {
          sku,
          name,
          categoryId,
          sellingPrice,
          costPrice,
          quantityOnHand: openingStock,
          reorderLevel,
        },
      });

      if (openingStock > 0) {
        await tx.productStockMovement.create({
          data: {
            productId: product.id,
            type: "opening",
            quantity: openingStock,
            reference: "OPENING-STOCK",
            notes: "Opening stock recorded when the product was created.",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "product.created",
          entityType: "Product",
          entityId: product.id,
          userId: currentUser.id,
          newValue: { sku, name, openingStock },
        },
      });
    });
  } catch (error) {
    goToProducts("error", readableError(error));
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  goToProducts("success", "Product created with an automatic SKU.");
}

export async function adjustStock(formData: FormData) {
  const currentUser = await requireCapability("products");
  const productId = requiredText(formData, "productId");
  const quantity = Number(requiredText(formData, "quantity"));
  const notes = requiredText(formData, "notes");

  if (!productId || !Number.isInteger(quantity) || quantity === 0 || notes.length < 3) {
    goToProducts("error", "Select a product, enter a non-zero whole quantity, and add a reason.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, status: "active" },
      });

      if (!product) {
        throw new Error("The selected product is not active.");
      }

      const newQuantity = product.quantityOnHand + quantity;
      if (newQuantity < 0) {
        throw new Error("This adjustment would make stock negative.");
      }

      await tx.product.update({
        where: { id: product.id },
        data: { quantityOnHand: newQuantity },
      });
      await tx.productStockMovement.create({
        data: {
          productId: product.id,
          type: "adjustment",
          quantity,
          reference: `ADJ-${Date.now()}`,
          notes,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "product.stock_adjusted",
          entityType: "Product",
          entityId: product.id,
          userId: currentUser.id,
          oldValue: { quantityOnHand: product.quantityOnHand },
          newValue: { quantityOnHand: newQuantity, adjustment: quantity, notes },
        },
      });
    });
  } catch (error) {
    goToProducts("error", readableError(error));
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  goToProducts("success", "Stock adjusted and movement recorded.");
}

export async function archiveProduct(formData: FormData) {
  const currentUser = await requireCapability("products");
  const productId = requiredText(formData, "productId");
  if (!productId) {
    goToProducts("error", "Product not found.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: productId },
        data: { status: "archived" },
      });
      await tx.auditLog.create({
        data: {
          action: "product.archived",
          entityType: "Product",
          entityId: product.id,
          userId: currentUser.id,
          oldValue: { status: "active" },
          newValue: { status: "archived" },
        },
      });
    });
  } catch (error) {
    goToProducts("error", readableError(error));
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  goToProducts("success", "Product archived. Historical records were preserved.");
}
