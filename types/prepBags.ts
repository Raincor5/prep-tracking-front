// types/prepBags.ts
export type PrepBag = {
  id: string; // Unique identifier
  dishName: string; // Name of the parent dish
  ingredients: { name: string; weight: number; unit: string }[]; // Ingredients needed for this prep bag
  addedIngredients: { name: string; weight: number; unit: string }[]; // Tracks ticked-off ingredients
  isComplete: boolean; // Indicates if all ingredients are added
};
