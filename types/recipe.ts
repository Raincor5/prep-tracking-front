// types/recipe.ts

export interface Ingredient {
    name: string;
    weight: number;
    unit: string;
  }
  
export type Recipe = {
  _id: string;
  name: string;
  originalPortion: number;
  ingredients: Array<{ name: string; weight: number; unit: string }>;
  steps: string[];
  colour? : string;
};
