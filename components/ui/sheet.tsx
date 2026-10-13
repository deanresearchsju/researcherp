"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Sheet(props: React.ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger {...props} />;
}

function SheetContent({
  className,
  children,
  title,
  side = "right",
  ...props
}: React.ComponentProps<typeof Dialog.Content> & {
  title: string;
  side?: "left" | "right";
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-purple-deep/40" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-[min(100%,18rem)] flex-col bg-white shadow-lift",
          side === "left" ? "left-0" : "right-0",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Dialog.Title className="font-heading text-lg text-primary">
            {title}
          </Dialog.Title>
          <Dialog.Close
            className="rounded-lg p-2 text-primary hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

function SheetClose(props: React.ComponentProps<typeof Dialog.Close>) {
  return <Dialog.Close {...props} />;
}

export { Sheet, SheetClose, SheetContent, SheetTrigger };
