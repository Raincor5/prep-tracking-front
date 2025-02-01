// Computes the effective count by merging confirmed with pending updates.
export const computeEffectiveCount = (
  confirmed: string[],
  pending: Record<string, boolean> | undefined,
  total: number,
  showMissing: boolean = false
): number => {
  const effective = new Set(confirmed);
  if (pending) {
    Object.entries(pending).forEach(([ing, toAdd]) => {
      if (toAdd) effective.add(ing);
      else effective.delete(ing);
    });
  }
  return showMissing ? total - effective.size : effective.size;
};