import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        gold: "bg-accent text-accent-foreground",
        purple: "bg-primary/10 text-primary",
        maroon: "bg-secondary/10 text-secondary",
        outline: "border border-border bg-white text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "purple",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
