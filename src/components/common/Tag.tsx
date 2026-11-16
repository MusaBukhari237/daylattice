import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  color?: string;
}

/** A small pill. When `color` (hex) is given, renders a tinted label chip. */
export function Tag({ color, className, style, children, ...rest }: Props) {
  const tinted = color
    ? {
        backgroundColor: `${color}1f`,
        color,
        ...style,
      }
    : style;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        !color && "bg-muted text-fg-subtle",
        className,
      )}
      style={tinted}
      {...rest}
    >
      {color && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </span>
  );
}
