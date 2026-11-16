import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:opacity-90 shadow-sm disabled:opacity-50",
  secondary:
    "bg-surface-2 text-fg hover:bg-muted border border-border disabled:opacity-50",
  ghost: "text-fg-subtle hover:bg-muted hover:text-fg",
  danger:
    "bg-rose-500 text-white hover:bg-rose-600 shadow-sm disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "secondary", size = "md", className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center font-medium transition-all duration-150 ease-smooth no-drag focus:outline-none focus:ring-2 focus:ring-accent/40 active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
