// types/recipe.ts

export interface Ingredient {
    name: string;
    weight: number;
    unit: string;
  }
  
  export interface Recipe {
    _id: string;
    name: string;
    originalPortion: number;
    ingredients: Ingredient[];
    steps: string[];
  }
  