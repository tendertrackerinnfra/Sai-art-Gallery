import type { LucideIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  helper,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  helper?: string;
  trend?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="relative gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl md:text-[28px]">{value}</CardTitle>
          </div>
          <span className="rounded-2xl bg-rose-50 p-3 text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        {(helper || trend) ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {trend ? (
              <span className={cn("rounded-full px-2 py-1 font-medium", trend.startsWith("-") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                {trend}
              </span>
            ) : null}
            {helper ? <span>{helper}</span> : null}
          </div>
        ) : null}
      </CardHeader>
    </Card>
  );
}
