// types/dish.ts
import { PrepBag } from '@/types/prepBags';

export interface Dish {
  id: string; // Unique identifier for the dish
  name: string;
  prepBags: PrepBag[];            // Active prep bags (still need work)
  completedPrepBags?: PrepBag[];    // Completed prep bags (all ingredients confirmed)
  ingredients: { name: string; weight: number; unit: string }[];
  quantity: number;               // Initial quantity (for reference)
  matrix: (PrepBag | null)[][];   // Matrix representation of the active prep bags
  colour?: string;                // Optional colour for the dish
}
