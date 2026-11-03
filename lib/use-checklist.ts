import { useEffect, useSyncExternalStore } from "react";

import {
  checklistItems,
  checklistsVersion,
  loadChecklists,
  subscribeChecklists,
  type ChecklistKey,
} from "@/lib/checklists";

/**
 * The items of one checklist, kept current on screen; the list in the code is shown until the
 * saved one arrives. (A hook, so it lives apart from lib/checklists, which server code also reads.)
 */
export function useChecklist(key: ChecklistKey) {
  useSyncExternalStore(subscribeChecklists, checklistsVersion, () => 0);
  useEffect(() => {
    void loadChecklists();
  }, []);
  return checklistItems(key);
}
