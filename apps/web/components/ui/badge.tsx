import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]", {
  variants: { variant: { default: "border-slate-300 bg-slate-100 text-slate-700", success: "border-emerald-200 bg-emerald-50 text-emerald-800", warning: "border-amber-200 bg-amber-50 text-amber-800", critical: "border-red-200 bg-red-50 text-red-800" } },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) { return <span className={cn(badgeVariants({ variant, className }))} {...props} />; }
export { Badge, badgeVariants };
