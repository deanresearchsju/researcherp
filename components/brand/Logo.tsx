import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  priority?: boolean;
  alt?: string;
};

export function Logo({ className, priority = false, alt }: LogoProps) {
  return (
    <Image
      src="/assets/logo-sju.jpg"
      alt={alt ?? "St. Joseph University"}
      width={1024}
      height={216}
      priority={priority}
      className={cn("h-14 w-auto", className)}
    />
  );
}
