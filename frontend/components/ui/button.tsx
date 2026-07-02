"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  buttonVariants,
  type ButtonVariantProps,
} from "./button-variants";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  /** Render as the single child element (e.g. a Next.js <Link>) instead of <button>. */
  asChild?: boolean;
}

/** Minimal Slot: merges Button styling/props onto its single child element. */
const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ children, className, ...props }, ref) => {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<any>;
    return React.cloneElement(child, {
      ...props,
      ...child.props,
      ref,
      className: cn(className, child.props.className),
    });
  }
);
Slot.displayName = "Slot";

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));
    if (asChild) {
      return (
        <Slot ref={ref as React.Ref<HTMLElement>} className={classes} {...props}>
          {props.children}
        </Slot>
      );
    }
    return <button ref={ref} className={classes} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
