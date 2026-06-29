import {
  AlertTriangle,
  Archive,
  Gem,
  PackagePlus,
  Scale,
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
import { formatCurrency, formatDate, formatQuantity } from "@/lib/format";

import {
  adjustRawMaterialStock,
  archiveRawMaterial,
  createRawMaterial,
} from "./actions";

export const dynamic = "force-dynamic";

type RawMaterialsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function loadRawMaterialInventory() {
  try {
    const [materials, movements] = await Promise.all([
      getDb().rawMaterial.findMany({
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
      }),
      getDb().rawMaterialStockMovement.findMany({
        include: {
          rawMaterial: {
            select: { sku: true, name: true, unit: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return { materials, movements, databaseError: false };
  } catch {
    return { materials: [], movements: [], databaseError: true };
  }
}

export default async function RawMaterialsPage({
  searchParams,
}: RawMaterialsPageProps) {
  await requireCapability("raw-materials");
  const [{ success, error }, inventory] = await Promise.all([
    searchParams,
    loadRawMaterialInventory(),
  ]);
  const lowStockCount = inventory.materials.filter(
    (material) => Number(material.quantityOnHand) <= Number(material.reorderLevel),
  ).length;
  const inventoryValue = inventory.materials.reduce(
    (total, material) =>
      total + Number(material.quantityOnHand) * Number(material.unitCost ?? 0),
    0,
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Raw Material Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Beads, wire, stones, chains, findings, and packaging with permanent stock history.
          </p>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700">Archive-only records</Badge>
      </div>

      {inventory.databaseError && (
        <Alert variant="destructive">
          <strong>Database unavailable.</strong> Check the configured PostgreSQL connection and
          migration status.
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Active materials</CardDescription>
            <CardTitle className="text-2xl">{inventory.materials.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Low stock materials</CardDescription>
            <CardTitle className="text-2xl">{lowStockCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Estimated stock value</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(inventoryValue)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4" aria-hidden="true" />
            Add raw material
          </CardTitle>
          <CardDescription>
            A sequential material SKU is generated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createRawMaterial} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="material-name">Material name</Label>
              <Input
                id="material-name"
                name="name"
                required
                minLength={2}
                placeholder="Freshwater pearl beads"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-unit">Stock unit</Label>
              <Select id="material-unit" name="unit" required defaultValue="">
                <option value="" disabled>Select unit</option>
                <option value="grams">Grams</option>
                <option value="kilograms">Kilograms</option>
                <option value="meters">Meters</option>
                <option value="centimeters">Centimeters</option>
                <option value="pieces">Pieces</option>
                <option value="strands">Strands</option>
                <option value="packets">Packets</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-unit-cost">Unit cost</Label>
              <Input
                id="material-unit-cost"
                name="unitCost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-opening-stock">Opening stock</Label>
              <Input
                id="material-opening-stock"
                name="openingStock"
                type="number"
                min="0"
                step="0.001"
                defaultValue="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-reorder-level">Reorder level</Label>
              <Input
                id="material-reorder-level"
                name="reorderLevel"
                type="number"
                min="0"
                step="0.001"
                defaultValue="0"
              />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={inventory.databaseError}>
                <PackagePlus className="h-4 w-4" aria-hidden="true" />
                Save material
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gem className="h-4 w-4" aria-hidden="true" />
            Active materials
          </CardTitle>
          <CardDescription>
            Quantities support up to three decimal places for weight and length.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {inventory.materials.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No raw materials yet. Add the first material above.
            </div>
          ) : (
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU / Material</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.materials.map((material) => {
                  const lowStock =
                    Number(material.quantityOnHand) <= Number(material.reorderLevel);
                  return (
                    <TableRow key={material.id}>
                      <TableCell>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {material.sku}
                        </span>
                        <span className="font-medium">{material.name}</span>
                      </TableCell>
                      <TableCell className="capitalize">{material.unit}</TableCell>
                      <TableCell className="text-right">
                        {material.unitCost
                          ? formatCurrency(material.unitCost.toString())
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatQuantity(material.quantityOnHand.toString())}
                      </TableCell>
                      <TableCell>
                        {lowStock ? (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                            <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                            Low stock
                          </Badge>
                        ) : (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            Available
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <form action={archiveRawMaterial}>
                          <input type="hidden" name="rawMaterialId" value={material.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            title={`Archive ${material.name}`}
                          >
                            <Archive className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Archive {material.name}</span>
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-4 w-4" aria-hidden="true" />
              Stock adjustment
            </CardTitle>
            <CardDescription>
              Positive quantities add stock; negative quantities remove stock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={adjustRawMaterialStock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjust-material">Raw material</Label>
                <Select
                  id="adjust-material"
                  name="rawMaterialId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>Select material</option>
                  {inventory.materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.sku} - {material.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-material-quantity">Quantity change</Label>
                <Input
                  id="adjust-material-quantity"
                  name="quantity"
                  type="number"
                  step="0.001"
                  required
                  placeholder="e.g. 2.5 or -0.25"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-material-notes">Reason</Label>
                <Input
                  id="adjust-material-notes"
                  name="notes"
                  required
                  minLength={3}
                  placeholder="Physical stock count"
                />
              </div>
              <Button
                type="submit"
                disabled={inventory.databaseError || inventory.materials.length === 0}
              >
                Record adjustment
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent stock movements</CardTitle>
            <CardDescription>
              Movement history is permanent and cannot be deleted from the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {inventory.movements.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No material stock movements recorded.
              </div>
            ) : (
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.movements.map((movement) => {
                    const quantity = Number(movement.quantity);
                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <span className="block font-medium">
                            {movement.rawMaterial.name}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {movement.rawMaterial.sku}
                          </span>
                        </TableCell>
                        <TableCell className="capitalize">
                          {movement.type.replaceAll("_", " ")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {movement.reference ?? "-"}
                        </TableCell>
                        <TableCell>{formatDate(movement.createdAt)}</TableCell>
                        <TableCell
                          className={
                            quantity > 0
                              ? "text-right font-medium text-emerald-700"
                              : "text-right font-medium text-red-700"
                          }
                        >
                          {quantity > 0 ? "+" : ""}
                          {formatQuantity(movement.quantity.toString())}{" "}
                          {movement.rawMaterial.unit}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
