import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-bg hover:bg-accent/90",
        outline: "border border-border bg-surface text-fg hover:bg-surface-2",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
      },
      size: {
        default: "h-11 px-4 text-sm",
        sm: "h-9 px-3 text-sm",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>
>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
