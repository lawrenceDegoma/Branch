import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Buttons are pills. The primary action is inverted (light on dark, dark on light); the brand
// orange is reserved for progress data and never fills a button.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent text-sm font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,transform] duration-(--duration-fast) ease-(--ease-out) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        outline: "border-control bg-transparent text-ink hover:bg-raised aria-expanded:bg-raised",
        secondary: "bg-raised text-ink hover:bg-raised/70 aria-expanded:bg-raised/70",
        ghost: "text-ink-muted hover:bg-raised hover:text-ink aria-expanded:bg-raised",
        destructive:
          "border-negative/40 bg-transparent text-negative hover:bg-negative-soft focus-visible:outline-negative",
        link: "rounded-sm px-0 text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 pointer-coarse:h-11",
        sm: "h-8 px-3 text-[0.8125rem] pointer-coarse:h-10",
        lg: "h-10 px-5 pointer-coarse:h-12",
        icon: "size-9 pointer-coarse:size-11",
        "icon-sm": "size-8 pointer-coarse:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
