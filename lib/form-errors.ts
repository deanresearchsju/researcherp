export function fieldMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  if ("root" in error) return fieldMessage(error.root);
  return undefined;
}

export function nestedMessage(error: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = error;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return fieldMessage(current);
}
