import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type DynamicRowsProps = {
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
};

export function DynamicRows({ addLabel, onAdd, children }: DynamicRowsProps) {
  return (
    <div className="space-y-3">
      {children}
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        {addLabel}
      </Button>
    </div>
  );
}
