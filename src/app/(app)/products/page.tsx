import { AlertTriangle, Archive, Boxes, PackagePlus, Tags } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/auth";

import { adjustStock, archiveProduct, createCategory, createProduct } from "./actions";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

async function loadInventory() {
  try {
    const [categories, products, movements] = await Promise.all([
      getDb().productCategory.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
      }),
      getDb().product.findMany({
        where: { status: "active" },
        include: { category: true },
        orderBy: { createdAt: "desc" },
      }),
      getDb().productStockMovement.findMany({
        include: { product: { select: { sku: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);
    return { categories, products, movements, databaseError: false };
  } catch {
    return { categories: [], products: [], movements: [], databaseError: true };
  }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requireCapability("products");
  const [{ success, error }, inventory] = await Promise.all([searchParams, loadInventory()]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Product Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Finished jewellery, automatic SKUs, stock levels, and permanent movement history.
          </p>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700">Archive-only records</Badge>
      </div>

      {inventory.databaseError && (
        <Alert variant="destructive">
          <strong>Database unavailable.</strong> Start PostgreSQL, create <code>sai_art_gallery_dev</code>,
          then run the migration and seed commands from the README.
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
              Add product
            </CardTitle>
            <CardDescription>The SKU is generated from the selected category prefix.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createProduct} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="product-name">Product name</Label>
                <Input id="product-name" name="name" required minLength={2} placeholder="Pearl drop earrings" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category">Category</Label>
                <Select id="product-category" name="categoryId" required defaultValue="">
                  <option value="" disabled>Select category</option>
                  {inventory.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.skuPrefix})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="selling-price">Selling price</Label>
                <Input id="selling-price" name="sellingPrice" type="number" min="0" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-price">Cost price</Label>
                <Input id="cost-price" name="costPrice" type="number" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-stock">Opening stock</Label>
                <Input id="opening-stock" name="openingStock" type="number" min="0" step="1" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorder-level">Reorder level</Label>
                <Input id="reorder-level" name="reorderLevel" type="number" min="0" step="1" defaultValue="2" />
              </div>
              <div className="flex items-end sm:col-span-2">
                <Button type="submit" disabled={inventory.databaseError || inventory.categories.length === 0}>
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  Save product
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" aria-hidden="true" />
              Add category
            </CardTitle>
            <CardDescription>Use a unique three-letter SKU prefix.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createCategory} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Category name</Label>
                <Input id="category-name" name="name" required minLength={2} placeholder="Anklets" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku-prefix">SKU prefix</Label>
                <Input id="sku-prefix" name="skuPrefix" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" placeholder="ANK" />
              </div>
              <Button type="submit" disabled={inventory.databaseError}>Save category</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-4 w-4" aria-hidden="true" />
            Active products
          </CardTitle>
          <CardDescription>{inventory.products.length} products available for sale.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {inventory.products.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No products yet. Add a category and your first jewellery product above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU / Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Selling price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.products.map((product) => {
                  const lowStock = product.quantityOnHand <= product.reorderLevel;
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <span className="block font-mono text-xs text-muted-foreground">{product.sku}</span>
                        <span className="font-medium">{product.name}</span>
                      </TableCell>
                      <TableCell>{product.category.name}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(product.sellingPrice.toString())}</TableCell>
                      <TableCell className="text-right">{product.quantityOnHand}</TableCell>
                      <TableCell>
                        {lowStock ? (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                            <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                            Low stock
                          </Badge>
                        ) : (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">In stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <form action={archiveProduct}>
                          <input type="hidden" name="productId" value={product.id} />
                          <Button type="submit" variant="ghost" size="icon" title={`Archive ${product.name}`}>
                            <Archive className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Archive {product.name}</span>
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
            <CardTitle>Stock adjustment</CardTitle>
            <CardDescription>Positive quantities add stock; negative quantities remove stock.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={adjustStock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjust-product">Product</Label>
                <Select id="adjust-product" name="productId" required defaultValue="">
                  <option value="" disabled>Select product</option>
                  {inventory.products.map((product) => (
                    <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-quantity">Quantity change</Label>
                <Input id="adjust-quantity" name="quantity" type="number" step="1" required placeholder="e.g. 3 or -1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-notes">Reason</Label>
                <Input id="adjust-notes" name="notes" required minLength={3} placeholder="Physical stock count" />
              </div>
              <Button type="submit" disabled={inventory.databaseError || inventory.products.length === 0}>Record adjustment</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent stock movements</CardTitle>
            <CardDescription>Stock history is permanent and cannot be deleted from the app.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {inventory.movements.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">No stock movements recorded.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Qty.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <span className="block font-medium">{movement.product.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{movement.product.sku}</span>
                      </TableCell>
                      <TableCell className="capitalize">{movement.type.replaceAll("_", " ")}</TableCell>
                      <TableCell className="font-mono text-xs">{movement.reference ?? "-"}</TableCell>
                      <TableCell>{formatDate(movement.createdAt)}</TableCell>
                      <TableCell className={movement.quantity > 0 ? "text-right font-medium text-emerald-700" : "text-right font-medium text-red-700"}>
                        {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
