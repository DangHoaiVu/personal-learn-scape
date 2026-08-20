import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { useLiquidPointer } from "@/components/app/liquid";

const buttonVariants = cva(
  "liquid-button [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        destructive: "",
        outline: "",
        secondary: "",
        ghost: "",
        link: "",
      },
      size: {
        default: "",
        sm: "",
        lg: "",
        icon: "liquid-icon-button",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const pointer = useLiquidPointer<HTMLElement>();
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        data-liquid-button=""
        data-variant={variant}
        data-size={size}
        type={asChild ? undefined : (type ?? "button")}
        ref={ref}
        {...pointer}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
