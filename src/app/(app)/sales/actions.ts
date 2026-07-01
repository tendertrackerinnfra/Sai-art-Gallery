"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCapability } from "@/lib/auth";
import { dataCacheTags, revalidateAppData } from "@/lib/data-cache";
import { getDb } from "@/lib/db";

const paymentMethods = new Set(["cash", "upi", "bank_transfer", "card", "other"]);
const saleItemSlots = 5;

type ParsedSaleItem = {
  productId: string;
  quantity: number;
  unitPrice: string;
  discount: string;
};

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  return requiredText(formData, key) || null;
}

function goToSales(type: "success" | "error", message: string): never {
  redirect(`/sales?${type}=${encodeURIComponent(message)}`);
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "The request could not be completed.";
}

function isMoney(value: string) {
  return /^\d+(?:\.\d{1,2})?$/.test(value);
}

function parseMoney(value: string, label: string) {
  if (!isMoney(value)) {
    throw new Error(`${label} must be a valid amount.`);
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} must be zero or more.`);
  }

  return amount;
}

function parseDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Enter a valid ${label}.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Enter a valid ${label}.`);
  }
  return date;
}

function derivePaymentStatus(grandTotal: number, amountPaid: number) {
  if (grandTotal <= 0 || amountPaid >= grandTotal) return "paid" as const;
  if (amountPaid > 0) return "partial" as const;
  return "pending" as const;
}

function readSaleItems(formData: FormData) {
  const items: ParsedSaleItem[] = [];

  for (let index = 1; index <= saleItemSlots; index += 1) {
    const productId = requiredText(formData, `productId_${index}`);
    const quantityText = requiredText(formData, `quantity_${index}`);
    const unitPrice = requiredText(formData, `unitPrice_${index}`);
    const discount = requiredText(formData, `discount_${index}`) || "0";
    const rowUsed = Boolean(productId || quantityText || unitPrice || discount !== "0");

    if (!rowUsed) continue;
    if (!productId || !quantityText || !unitPrice) {
      throw new Error(`Complete product, quantity, and unit price for line ${index}.`);
    }

    const quantity = Number(quantityText);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Line ${index} quantity must be a positive whole number.`);
    }
    if (!isMoney(unitPrice)) {
      throw new Error(`Line ${index} unit price must be a valid amount.`);
    }
    if (!isMoney(discount)) {
      throw new Error(`Line ${index} discount must be a valid amount.`);
    }

    items.push({ productId, quantity, unitPrice, discount });
  }

  if (items.length === 0) {
    throw new Error("Add at least one sale item.");
  }

  const uniqueProducts = new Set(items.map((item) => item.productId));
  if (uniqueProducts.size !== items.length) {
    throw new Error("Each product can be added only once per sale.");
  }

  return items;
}

async function buildSaleNumber(tx: {
  sale: {
    findMany(args: {
      select: { saleNumber: true };
      where: { saleNumber: { startsWith: string } };
    }): Promise<Array<{ saleNumber: string }>>;
  };
}) {
  const sales = await tx.sale.findMany({
    select: { saleNumber: true },
    where: { saleNumber: { startsWith: "SAG-SAL-" } },
  });
  const nextNumber =
    sales.reduce((highest, sale) => {
      const sequence = Number(sale.saleNumber.split("-").at(-1));
      return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
    }, 0) + 1;

  return `SAG-SAL-${String(nextNumber).padStart(4, "0")}`;
}

export async function createSale(formData: FormData) {
  const currentUser = await requireCapability("sales");

  try {
    const customerId = requiredText(formData, "customerId") || null;
    const saleDateText = requiredText(formData, "saleDate");
    const additionalDiscountText = requiredText(formData, "additionalDiscount") || "0";
    const taxTotalText = requiredText(formData, "taxTotal") || "0";
    const initialPaymentText = requiredText(formData, "initialPayment") || "0";
    const paymentMethod = requiredText(formData, "paymentMethod");
    const paymentReference = optionalText(formData, "paymentReference");
    const paymentDateText = requiredText(formData, "paymentDate");

    const saleDate = parseDate(saleDateText, "sale date");
    const paymentDate = parseDate(paymentDateText, "payment date");
    const additionalDiscount = parseMoney(additionalDiscountText, "Additional discount");
    const taxTotal = parseMoney(taxTotalText, "Tax total");
    const initialPayment = parseMoney(initialPaymentText, "Initial payment");
    const items = readSaleItems(formData);

    if (initialPayment > 0 && !paymentMethods.has(paymentMethod)) {
      throw new Error("Select a payment method for the initial payment.");
    }
    if (initialPayment === 0 && paymentMethod) {
      throw new Error("Remove the payment method or enter an initial payment amount.");
    }

    await getDb().$transaction(async (tx) => {
      if (customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: customerId, status: "active" },
          select: { id: true },
        });
        if (!customer) {
          throw new Error("Select an active customer or leave the sale as walk-in.");
        }
      }

      const products = await tx.product.findMany({
        where: {
          id: { in: items.map((item) => item.productId) },
          status: "active",
        },
        select: {
          id: true,
          name: true,
          sku: true,
          sellingPrice: true,
          quantityOnHand: true,
        },
      });

      if (products.length !== items.length) {
        throw new Error("One or more selected products are not active.");
      }

      const productMap = new Map(products.map((product) => [product.id, product]));

      let subtotal = 0;
      let itemDiscountTotal = 0;
      const saleItems = items.map((item, index) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product line ${index + 1} is invalid.`);
        }
        if (product.quantityOnHand < item.quantity) {
          throw new Error(`${product.name} has only ${product.quantityOnHand} units in stock.`);
        }

        const unitPrice = parseMoney(item.unitPrice, `Line ${index + 1} unit price`);
        const discount = parseMoney(item.discount, `Line ${index + 1} discount`);
        const lineSubtotal = unitPrice * item.quantity;
        if (discount > lineSubtotal) {
          throw new Error(`Line ${index + 1} discount cannot exceed the line subtotal.`);
        }

        subtotal += lineSubtotal;
        itemDiscountTotal += discount;

        return {
          product,
          quantity: item.quantity,
          unitPrice,
          discount,
          lineTotal: lineSubtotal - discount,
        };
      });

      const discountTotal = itemDiscountTotal + additionalDiscount;
      if (discountTotal > subtotal) {
        throw new Error("Total discount cannot exceed the subtotal.");
      }

      const grandTotal = subtotal - discountTotal + taxTotal;
      if (grandTotal < 0) {
        throw new Error("Grand total cannot be negative.");
      }
      if (initialPayment > grandTotal) {
        throw new Error("Initial payment cannot exceed the sale total.");
      }

      const saleNumber = await buildSaleNumber(tx);
      const paymentStatus = derivePaymentStatus(grandTotal, initialPayment);

      const sale = await tx.sale.create({
        data: {
          saleNumber,
          customerId,
          saleDate,
          subtotal: subtotal.toFixed(2),
          discountTotal: discountTotal.toFixed(2),
          taxTotal: taxTotal.toFixed(2),
          grandTotal: grandTotal.toFixed(2),
          paymentStatus,
          items: {
            create: saleItems.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toFixed(2),
              discount: item.discount.toFixed(2),
              lineTotal: item.lineTotal.toFixed(2),
            })),
          },
          payments:
            initialPayment > 0
              ? {
                  create: {
                    amount: initialPayment.toFixed(2),
                    method: paymentMethod,
                    reference: paymentReference,
                    paymentDate,
                    status: "paid",
                  },
                }
              : undefined,
        },
        include: {
          customer: { select: { name: true } },
        },
      });

      for (const item of saleItems) {
        const newQuantity = item.product.quantityOnHand - item.quantity;
        await tx.product.update({
          where: { id: item.product.id },
          data: { quantityOnHand: newQuantity },
        });
        await tx.productStockMovement.create({
          data: {
            productId: item.product.id,
            type: "sale",
            quantity: -item.quantity,
            reference: saleNumber,
            notes: `Sale recorded for ${sale.customer?.name ?? "walk-in customer"}.`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "sale.created",
          entityType: "Sale",
          entityId: sale.id,
          userId: currentUser.id,
          newValue: {
            saleNumber,
            customer: sale.customer?.name ?? null,
            saleDate: saleDateText,
            subtotal: subtotal.toFixed(2),
            discountTotal: discountTotal.toFixed(2),
            taxTotal: taxTotal.toFixed(2),
            grandTotal: grandTotal.toFixed(2),
            paymentStatus,
            initialPayment: initialPayment.toFixed(2),
            items: saleItems.map((item) => ({
              productId: item.product.id,
              sku: item.product.sku,
              name: item.product.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toFixed(2),
              discount: item.discount.toFixed(2),
              lineTotal: item.lineTotal.toFixed(2),
            })),
          },
        },
      });
    });
  } catch (error) {
    goToSales("error", readableError(error));
  }

  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
  revalidateAppData(
    dataCacheTags.sales,
    dataCacheTags.products,
    dataCacheTags.customers,
    dataCacheTags.dashboard,
    dataCacheTags.finance,
  );
  goToSales("success", "Sale recorded, stock deducted, and audit log written.");
}

export async function recordSalePayment(formData: FormData) {
  const currentUser = await requireCapability("sales");

  try {
    const saleId = requiredText(formData, "saleId");
    const amountText = requiredText(formData, "amount");
    const method = requiredText(formData, "method");
    const reference = optionalText(formData, "reference");
    const paymentDateText = requiredText(formData, "paymentDate");

    if (!saleId) {
      throw new Error("Sale not found.");
    }
    if (!paymentMethods.has(method)) {
      throw new Error("Select a valid payment method.");
    }

    const amount = parseMoney(amountText, "Payment amount");
    if (amount <= 0) {
      throw new Error("Payment amount must be more than zero.");
    }

    const paymentDate = parseDate(paymentDateText, "payment date");

    await getDb().$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, status: "active" },
        include: {
          customer: { select: { name: true } },
          payments: {
            where: { status: "paid" },
            select: { amount: true },
          },
        },
      });

      if (!sale) {
        throw new Error("The selected sale is not active.");
      }

      const amountPaidSoFar = sale.payments.reduce((total, payment) => total + Number(payment.amount), 0);
      const grandTotal = Number(sale.grandTotal);
      if (amountPaidSoFar + amount > grandTotal) {
        throw new Error("This payment would exceed the sale total.");
      }

      const updatedPaymentStatus = derivePaymentStatus(grandTotal, amountPaidSoFar + amount);

      const payment = await tx.salePayment.create({
        data: {
          saleId,
          amount: amount.toFixed(2),
          method,
          reference,
          paymentDate,
          status: "paid",
        },
      });

      await tx.sale.update({
        where: { id: saleId },
        data: { paymentStatus: updatedPaymentStatus },
      });

      await tx.auditLog.create({
        data: {
          action: "sale.payment_recorded",
          entityType: "SalePayment",
          entityId: payment.id,
          userId: currentUser.id,
          newValue: {
            saleId,
            saleNumber: sale.saleNumber,
            customer: sale.customer?.name ?? null,
            amount: amount.toFixed(2),
            method,
            reference,
            paymentDate: paymentDateText,
            paymentStatus: updatedPaymentStatus,
          },
        },
      });
    });
  } catch (error) {
    goToSales("error", readableError(error));
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
  revalidateAppData(
    dataCacheTags.sales,
    dataCacheTags.customers,
    dataCacheTags.dashboard,
    dataCacheTags.finance,
  );
  goToSales("success", "Sale payment recorded.");
}

export async function cancelSale(formData: FormData) {
  const currentUser = await requireCapability("sales");

  try {
    const saleId = requiredText(formData, "saleId");
    const reason = requiredText(formData, "reason");

    if (!saleId) {
      throw new Error("Sale not found.");
    }
    if (reason.length < 5 || reason.length > 300) {
      throw new Error("Enter a cancellation reason between 5 and 300 characters.");
    }

    await getDb().$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, status: "active" },
        include: {
          customer: { select: { name: true } },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  quantityOnHand: true,
                },
              },
            },
          },
          payments: {
            where: { status: "paid" },
            select: { id: true },
          },
        },
      });

      if (!sale) {
        throw new Error("The selected sale is not active.");
      }
      if (sale.payments.length > 0) {
        throw new Error("Sales with recorded payments cannot be cancelled from this screen.");
      }

      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: "cancelled",
          paymentStatus: "cancelled",
        },
      });

      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.product.id },
          data: { quantityOnHand: item.product.quantityOnHand + item.quantity },
        });
        await tx.productStockMovement.create({
          data: {
            productId: item.product.id,
            type: "void",
            quantity: item.quantity,
            reference: sale.saleNumber,
            notes: `Sale cancelled: ${reason}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "sale.cancelled",
          entityType: "Sale",
          entityId: saleId,
          userId: currentUser.id,
          oldValue: {
            status: "active",
            paymentStatus: sale.paymentStatus,
          },
          newValue: {
            status: "cancelled",
            paymentStatus: "cancelled",
            reason,
          },
        },
      });
    });
  } catch (error) {
    goToSales("error", readableError(error));
  }

  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
  revalidateAppData(
    dataCacheTags.sales,
    dataCacheTags.products,
    dataCacheTags.dashboard,
    dataCacheTags.finance,
  );
  goToSales("success", "Sale cancelled and stock restored.");
}
