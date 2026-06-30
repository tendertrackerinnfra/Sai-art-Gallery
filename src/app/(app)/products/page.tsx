import Link from "next/link";
import { AlertTriangle, Archive, Boxes, ImagePlus, PackagePlus, Search, SlidersHorizontal, Tags } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDb } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/auth";
import { isMobileRequest } from "@/lib/request-device";

import { adjustStock, archiveProduct, createCategory, createProduct } from "./actions";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{ success?: string; error?: string; q?: string; category?: string; archived?: string }>;
};

async function loadInventory(query: string, categoryId: string, includeArchived: boolean) {
  try {
    const [categories, products, movements] = await Promise.all([
      getDb().productCategory.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
      }),
      getDb().product.findMany({
        where: {
          ...(includeArchived ? {} : { status: "active" }),
          ...(categoryId ? { categoryId } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  { sku: { contains: query, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        include: { category: true },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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
  const [params, preferMobileCards] = await Promise.all([searchParams, isMobileRequest()]);
  const query = params.q?.trim() ?? "";
  const selectedCategory = params.category?.trim() ?? "";
  const includeArchived = params.archived === "1";
  const inventory = await loadInventory(query, selectedCategory, includeArchived);

  const lowStockCount = inventory.products.filter(
    (product) => product.status === "active" && product.quantityOnHand > 0 && product.quantityOnHand <= product.reorderLevel,
  ).length;
  const outOfStockCount = inventory.products.filter(
    (product) => product.status === "active" && product.quantityOnHand <= 0,
  ).length;
  const inventoryValue = inventory.products
    .filter((product) => product.status === "active")
    .reduce((total, product) => total + Number(product.sellingPrice) * product.quantityOnHand, 0);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Finished jewellery products, automatic SKU control, archive-safe records, and permanent stock movement history."
        badge={<StatusBadge tone="archived" label="Archive-only records" />}
      />

      {inventory.databaseError && (
        <Alert variant="destructive">
          <strong>Database unavailable.</strong> Start PostgreSQL, create <code>sai_art_gallery_dev</code>,
          then run the migration and seed commands from the README.
        </Alert>
      )}
      {params.success && <Alert variant="success">{params.success}</Alert>}
      {params.error && <Alert variant="destructive">{params.error}</Alert>}

      {lowStockCount > 0 || outOfStockCount > 0 ? (
        <Alert>
          <strong>Stock attention:</strong> {lowStockCount} low-stock items and {outOfStockCount} out-of-stock items need review.
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard icon={Boxes} label="Visible products" value={inventory.products.length} helper="Filtered inventory records" />
        <StatCard icon={AlertTriangle} label="Low stock" value={lowStockCount} helper="At or below reorder level" />
        <StatCard icon={PackagePlus} label="Out of stock" value={outOfStockCount} helper="Unavailable for sale" />
        <StatCard icon={Tags} label="Inventory value" value={formatCurrency(inventoryValue)} helper="Estimated using selling price" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
              Add product
            </CardTitle>
            <CardDescription>The SKU is generated from the selected category prefix. Presentation-only fields are included for future schema extension.</CardDescription>
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
              <div className="space-y-2">
                <Label htmlFor="image-placeholder">Product image placeholder</Label>
                <Input id="image-placeholder" placeholder="Image upload in next phase" disabled aria-disabled="true" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="material-placeholder">Material / metal</Label>
                <Input id="material-placeholder" placeholder="Schema extension required" disabled aria-disabled="true" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight-placeholder">Weight / making charge</Label>
                <Input id="weight-placeholder" placeholder="Schema extension required" disabled aria-disabled="true" />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
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
          <CardContent className="space-y-4">
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

            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <ImagePlus className="h-4 w-4 text-primary" aria-hidden="true" />
                Product visuals
              </div>
              <p className="mt-2">Product image uploads and richer product specifications can be layered in without changing current stock or archive rules.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        title="Product directory"
        description={`${inventory.products.length} product records in the current view.`}
        toolbar={
          <form method="get" className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input name="q" defaultValue={query} placeholder="Search SKU or product" className="pl-9" />
            </div>
            <Select name="category" defaultValue={selectedCategory}>
              <option value="">All categories</option>
              {inventory.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm">
              <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Include archived
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Apply
              </Button>
              {(query || selectedCategory || includeArchived) ? (
                <Link href="/products" className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-medium hover:bg-muted">
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        }
        columns={[
          {
            header: "Product",
            render: (product) => (
              <>
                <span className="block font-mono text-xs text-muted-foreground">{product.sku}</span>
                <span className="font-medium">{product.name}</span>
              </>
            ),
          },
          {
            header: "Category",
            render: (product) => product.category.name,
          },
          {
            header: "Price",
            className: "text-right",
            render: (product) => <span className="font-medium">{formatCurrency(product.sellingPrice.toString())}</span>,
          },
          {
            header: "Stock",
            className: "text-right",
            render: (product) => product.quantityOnHand,
          },
          {
            header: "Status",
            render: (product) =>
              product.status !== "active" ? (
                <StatusBadge tone="archived" />
              ) : product.quantityOnHand <= 0 ? (
                <StatusBadge tone="out_of_stock" />
              ) : product.quantityOnHand <= product.reorderLevel ? (
                <StatusBadge tone="low_stock" />
              ) : (
                <StatusBadge tone="in_stock" />
              ),
          },
          {
            header: "Actions",
            className: "text-right",
            render: (product) =>
              product.status === "active" ? (
                <form action={archiveProduct} className="flex justify-end">
                  <input type="hidden" name="productId" value={product.id} />
                  <Button type="submit" variant="ghost" size="icon" title={`Archive ${product.name}`}>
                    <Archive className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Archive {product.name}</span>
                  </Button>
                </form>
              ) : (
                <span className="text-xs text-muted-foreground">Archived</span>
              ),
          },
        ]}
        rows={inventory.products}
        getRowKey={(product) => product.id}
        preferMobileCards={preferMobileCards}
        pageSize={12}
        renderMobileCard={(product) => (
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{product.sku}</p>
              </div>
              {product.status !== "active" ? (
                <StatusBadge tone="archived" />
              ) : product.quantityOnHand <= 0 ? (
                <StatusBadge tone="out_of_stock" />
              ) : product.quantityOnHand <= product.reorderLevel ? (
                <StatusBadge tone="low_stock" />
              ) : (
                <StatusBadge tone="in_stock" />
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">{product.category.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Selling price</p>
                <p className="font-medium">{formatCurrency(product.sellingPrice.toString())}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Stock</p>
                <p className="font-medium">{product.quantityOnHand}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reorder level</p>
                <p className="font-medium">{product.reorderLevel}</p>
              </div>
            </div>
            {product.status === "active" ? (
              <form action={archiveProduct} className="mt-4">
                <input type="hidden" name="productId" value={product.id} />
                <Button type="submit" variant="outline" className="w-full">
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  Archive
                </Button>
              </form>
            ) : null}
          </div>
        )}
        empty={{
          icon: Boxes,
          title: query || selectedCategory ? "No products match these filters" : "No products yet",
          description: query || selectedCategory ? "Adjust the search or category filter to widen the inventory view." : "Add a category and save the first finished jewellery product above.",
        }}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Stock adjustment</CardTitle>
            <CardDescription>Positive quantities add stock. Negative quantities remove stock and are preserved in movement history.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={adjustStock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjust-product">Product</Label>
                <Select id="adjust-product" name="productId" required defaultValue="">
                  <option value="" disabled>Select product</option>
                  {inventory.products.filter((product) => product.status === "active").map((product) => (
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
              <Button type="submit" disabled={inventory.databaseError || inventory.products.filter((product) => product.status === "active").length === 0}>Record adjustment</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent stock movements</CardTitle>
            <CardDescription>Stock movement history is permanent and archive-safe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inventory.movements.length === 0 ? (
              <EmptyState icon={PackagePlus} title="No stock movements yet" description="Opening stock, sale deductions, and manual adjustments will appear here." />
            ) : (
              inventory.movements.map((movement) => (
                <div key={movement.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
                  <div>
                    <p className="font-medium">{movement.product.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{movement.product.sku}</p>
                    <p className="mt-2 text-sm capitalize text-muted-foreground">{movement.type.replaceAll("_", " ")} · {movement.reference ?? "No reference"}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${movement.quantity > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(movement.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
