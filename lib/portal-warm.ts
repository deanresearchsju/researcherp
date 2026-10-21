import { isOfficeRole } from "@/lib/access";
import { subscribeDoctoral } from "@/lib/doctoral";
import { subscribeOffice } from "@/lib/office";
import { subscribeApplications } from "@/lib/records";
import { subscribeRegister } from "@/lib/register";
import { preloadScholarRecords } from "@/lib/scholar-records";
import type { Role } from "@/types";

const noop = () => undefined;
let warmed: Role | null = null;

/**
 * Starts the shared portal data loading once after sign-in, all in parallel, so each menu
 * opens with its data already in memory instead of fetching on arrival.
 */
export function warmPortalData(role: Role) {
  if (warmed === role) return;
  warmed = role;
  const stores: ((onChange: () => void) => () => unknown)[] = [
    subscribeOffice,
    subscribeDoctoral,
    subscribeRegister,
  ];
  if (isOfficeRole(role)) stores.push(subscribeApplications);
  stores.forEach((subscribe) => subscribe(noop)());
  preloadScholarRecords();
}
