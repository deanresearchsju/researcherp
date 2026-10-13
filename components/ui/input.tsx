import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-none placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
