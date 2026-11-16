import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...rest }, ref) => (
  <select
    ref={ref}
    className={cn("input cursor-pointer appearance-none pr-8", className)}
    {...rest}
  >
    {children}
  </select>
));
Select.displayName = "Select";
