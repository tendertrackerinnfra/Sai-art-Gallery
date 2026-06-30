import { AlertTriangle, Archive, Ban, BadgeCheck, CircleDot, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeTone =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "paid"
  | "partial"
  | "pending"
  | "voided"
  | "archived"
  | "active"
  | "cancelled";

const styles: Record<StatusBadgeTone, { label: string; className: string; Icon: typeof CircleDot }> = {
  in_stock: {
    label: "In stock",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: BadgeCheck,
  },
  low_stock: {
    label: "Low stock",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    Icon: AlertTriangle,
  },
  out_of_stock: {
    label: "Out of stock",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    Icon: Ban,
  },
  paid: {
    label: "Paid",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: BadgeCheck,
  },
  partial: {
    label: "Partial",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    Icon: CircleDot,
  },
  pending: {
    label: "Pending",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    Icon: Clock3,
  },
  voided: {
    label: "Voided",
    className: "border-red-200 bg-red-50 text-red-700",
    Icon: Ban,
  },
  archived: {
    label: "Archived",
    className: "border-stone-200 bg-stone-50 text-stone-700",
    Icon: Archive,
  },
  active: {
    label: "Active",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: BadgeCheck,
  },
  cancelled: {
    label: "Cancelled",
    className: "border-red-200 bg-red-50 text-red-700",
    Icon: Ban,
  },
};

export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: StatusBadgeTone;
  label?: string;
  className?: string;
}) {
  const { className: toneClassName, Icon, label: defaultLabel } = styles[tone];

  return (
    <Badge className={cn("gap-1.5 rounded-full px-2.5 py-1 font-medium", toneClassName, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label ?? defaultLabel}
    </Badge>
  );
}
