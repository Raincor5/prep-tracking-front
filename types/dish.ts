// types/dish.ts
import { PrepBag } from '@/types/prepBags';

export interface Dish {
  id: string; // Unique identifier for the dish
  name: string;
  prepBags: PrepBag[];
  ingredients: { name: string; weight: number; unit: string }[];
  quantity: number;
  matrix: (PrepBag | null)[][]; // Matrix representation of the dish's prep bags
  colour?: string; // Optional colour for the dish
}
