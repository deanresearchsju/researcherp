import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
