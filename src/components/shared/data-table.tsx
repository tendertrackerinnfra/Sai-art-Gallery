import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DataColumn<T> = {
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  title,
  description,
  toolbar,
  columns,
  rows,
  getRowKey,
  renderMobileCard,
  empty,
  desktopMinWidthClassName = "min-w-[760px]",
  pageSize = 20,
}: {
  title: string;
  description?: string;
  toolbar?: ReactNode;
  columns: DataColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  renderMobileCard: (row: T) => ReactNode;
  empty: {
    icon: Parameters<typeof EmptyState>[0]["icon"];
    title: string;
    description: string;
    action?: ReactNode;
  };
  desktopMinWidthClassName?: string;
  pageSize?: number;
}) {
  const visibleRows = rows.slice(0, pageSize);
  const hasMore = rows.length > pageSize;

  return (
    <Card>
      <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-1.5">{description}</CardDescription> : null}
        </div>
        {toolbar ? <div className="w-full md:w-auto">{toolbar}</div> : null}
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState {...empty} />
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {visibleRows.map((row) => (
                <div key={getRowKey(row)}>{renderMobileCard(row)}</div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table className={desktopMinWidthClassName}>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column.header} className={column.className}>
                        {column.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={getRowKey(row)}>
                      {columns.map((column) => (
                        <TableCell key={column.header} className={column.className}>
                          {column.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {hasMore ? (
              <div className="border-t border-border/70 px-4 py-3 text-sm text-muted-foreground">
                Showing first {pageSize} of {rows.length} rows in this view.
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
