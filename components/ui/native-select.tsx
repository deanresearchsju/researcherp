import * as React from "react";

import { cn } from "@/lib/utils";

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
