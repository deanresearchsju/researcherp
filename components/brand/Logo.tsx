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
      sizes="320px"
      className={cn("h-16 w-auto object-contain", className)}
    />
  );
}
