// utils/groupPrepBags.ts

import { PrepBag } from "@/types/prepBags";

export const groupPrepBags = (prepBags: PrepBag[], maxPerColumn: number = 8): PrepBag[][] => {
    const grouped: PrepBag[][] = [];
    for (let i = 0; i < prepBags.length; i += maxPerColumn) {
      grouped.push(prepBags.slice(i, i + maxPerColumn));
    }
    return grouped;
  };
  