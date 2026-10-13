import { Logo } from "@/components/brand/Logo";

export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status">
      <Logo alt="" className="h-14 w-auto animate-pulse" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
