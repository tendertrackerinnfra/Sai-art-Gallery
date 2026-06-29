"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";

const materialUnits = new Set([
  "grams",
  "kilograms",
  "meters",
  "centimeters",
  "pieces",
  "strands",
  "packets",
]);

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validDecimal(value: string, decimalPlaces: number, allowNegative = false) {
  const sign = allowNegative ? "-?" : "";
  return new RegExp(`^${sign}\\d+(?:\\.\\d{1,${decimalPlaces}})?$`).test(value);
}

function goToRawMaterials(type: "success" | "error", message: string): never {
  redirect(`/raw-materials?${type}=${encodeURIComponent(message)}`);
}

function readableError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return "A material with this SKU already exists. Please try again.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "The request could not be completed.";
}

export async function createRawMaterial(formData: FormData) {
  const currentUser = await requireCapability("raw-materials");
  const name = requiredText(formData, "name");
  const unit = requiredText(formData, "unit");
  const unitCostText = requiredText(formData, "unitCost");
  const openingStockText = requiredText(formData, "openingStock") || "0";
  const reorderLevelText = requiredText(formData, "reorderLevel") || "0";

  if (
    name.length < 2 ||
    !materialUnits.has(unit) ||
    (unitCostText && (!validDecimal(unitCostText, 2) || Number(unitCostText) < 0)) ||
    !validDecimal(openingStockText, 3) ||
    Number(openingStockText) < 0 ||
    !validDecimal(reorderLevelText, 3) ||
    Number(reorderLevelText) < 0
  ) {
    goToRawMaterials("error", "Check the material name, unit, cost, and stock quantities.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const materials = await tx.rawMaterial.findMany({
        where: { sku: { startsWith: "SAG-RM-" } },
        select: { sku: true },
      });
      const nextNumber =
        materials.reduce((highest, material) => {
          const sequence = Number(material.sku?.split("-").at(-1));
          return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
        }, 0) + 1;
      const sku = `SAG-RM-${String(nextNumber).padStart(4, "0")}`;

      const material = await tx.rawMaterial.create({
        data: {
          sku,
          name,
          unit,
          unitCost: unitCostText || null,
          quantityOnHand: openingStockText,
          reorderLevel: reorderLevelText,
        },
      });

      if (Number(openingStockText) > 0) {
        await tx.rawMaterialStockMovement.create({
          data: {
            rawMaterialId: material.id,
            type: "opening",
            quantity: openingStockText,
            reference: "OPENING-STOCK",
            notes: "Opening stock recorded when the material was created.",
            createdById: currentUser.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "raw_material.created",
          entityType: "RawMaterial",
          entityId: material.id,
          userId: currentUser.id,
          newValue: {
            sku,
            name,
            unit,
            unitCost: unitCostText || null,
            openingStock: openingStockText,
          },
        },
      });
    });
  } catch (error) {
    goToRawMaterials("error", readableError(error));
  }

  revalidatePath("/raw-materials");
  revalidatePath("/dashboard");
  goToRawMaterials("success", "Raw material created with an automatic SKU.");
}

export async function adjustRawMaterialStock(formData: FormData) {
  const currentUser = await requireCapability("raw-materials");
  const rawMaterialId = requiredText(formData, "rawMaterialId");
  const quantityText = requiredText(formData, "quantity");
  const notes = requiredText(formData, "notes");

  if (
    !rawMaterialId ||
    !validDecimal(quantityText, 3, true) ||
    Number(quantityText) === 0 ||
    notes.length < 3
  ) {
    goToRawMaterials(
      "error",
      "Select a material, enter a non-zero quantity with up to three decimals, and add a reason.",
    );
  }

  try {
    await getDb().$transaction(async (tx) => {
      const material = await tx.rawMaterial.findFirst({
        where: { id: rawMaterialId, status: "active" },
      });

      if (!material) {
        throw new Error("The selected raw material is not active.");
      }

      const oldQuantity = Number(material.quantityOnHand);
      const newQuantity = oldQuantity + Number(quantityText);
      if (newQuantity < 0) {
        throw new Error("This adjustment would make stock negative.");
      }
      const normalizedQuantity = newQuantity.toFixed(3);

      await tx.rawMaterial.update({
        where: { id: material.id },
        data: { quantityOnHand: normalizedQuantity },
      });
      await tx.rawMaterialStockMovement.create({
        data: {
          rawMaterialId: material.id,
          type: "adjustment",
          quantity: quantityText,
          reference: `ADJ-${Date.now()}`,
          notes,
          createdById: currentUser.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "raw_material.stock_adjusted",
          entityType: "RawMaterial",
          entityId: material.id,
          userId: currentUser.id,
          oldValue: { quantityOnHand: material.quantityOnHand.toString() },
          newValue: {
            quantityOnHand: normalizedQuantity,
            adjustment: quantityText,
            notes,
          },
        },
      });
    });
  } catch (error) {
    goToRawMaterials("error", readableError(error));
  }

  revalidatePath("/raw-materials");
  revalidatePath("/dashboard");
  goToRawMaterials("success", "Material stock adjusted and movement recorded.");
}

export async function archiveRawMaterial(formData: FormData) {
  const currentUser = await requireCapability("raw-materials");
  const rawMaterialId = requiredText(formData, "rawMaterialId");

  if (!rawMaterialId) {
    goToRawMaterials("error", "Raw material not found.");
  }

  try {
    await getDb().$transaction(async (tx) => {
      const material = await tx.rawMaterial.findFirst({
        where: { id: rawMaterialId, status: "active" },
      });
      if (!material) {
        throw new Error("The selected raw material is not active.");
      }

      await tx.rawMaterial.update({
        where: { id: material.id },
        data: { status: "archived" },
      });
      await tx.auditLog.create({
        data: {
          action: "raw_material.archived",
          entityType: "RawMaterial",
          entityId: material.id,
          userId: currentUser.id,
          oldValue: { status: "active" },
          newValue: { status: "archived" },
        },
      });
    });
  } catch (error) {
    goToRawMaterials("error", readableError(error));
  }

  revalidatePath("/raw-materials");
  revalidatePath("/dashboard");
  goToRawMaterials("success", "Raw material archived. Historical records were preserved.");
}
