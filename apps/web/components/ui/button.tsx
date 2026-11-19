import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:pointer-events-none disabled:opacity-50", {
  variants: { variant: { default: "border border-blue-800 bg-blue-700 text-white hover:bg-blue-800", outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100", ghost: "text-slate-700 hover:bg-slate-100" }, size: { default: "h-8 px-3 py-1.5", icon: "h-8 w-8" } },
  defaultVariants: { variant: "default", size: "default" },
});

function Button({ className, variant, size, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
