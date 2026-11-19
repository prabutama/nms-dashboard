import * as React from "react";
import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) { return <div className="relative w-full overflow-auto overscroll-contain" tabIndex={0} role="region" aria-label="Data table"><table className={cn("w-full caption-bottom text-xs", className)} {...props} /></div>; }
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) { return <thead className={cn("[&_tr]:border-b [&_tr]:border-slate-300", className)} {...props} />; }
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) { return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />; }
function TableRow({ className, ...props }: React.ComponentProps<"tr">) { return <tr className={cn("border-b border-slate-200 transition-colors hover:bg-slate-50", className)} {...props} />; }
function TableHead({ className, ...props }: React.ComponentProps<"th">) { return <th scope="col" className={cn("h-9 whitespace-nowrap px-3 text-left align-middle text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500", className)} {...props} />; }
function TableCell({ className, ...props }: React.ComponentProps<"td">) { return <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />; }
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
