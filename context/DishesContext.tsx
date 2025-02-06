// context/DishesContext.tsx

import React, { createContext, useContext, useState } from 'react';
import { Dish } from '@/types/dish';
import { PrepBag } from '@/types/prepBags';
import { nanoid as uuidv4 } from 'nanoid/non-secure';

type DishesContextType = {
  dishesStack: Dish[];
  addDish: (dish: Omit<Dish, 'id' | 'prepBags' | 'matrix' | 'quantity' | 'completedPrepBags'>, quantity: number) => void;
  undoDish: () => void;
  clearDishes: () => void;
  removeDish: (name: string) => void;
  updateDish: (name: string, quantity: number, ingredients: Dish['ingredients']) => void;
  updatePrepBag: (
    prepBagId: string,
    newAddedIngredients: { name: string; weight: number; unit: string }[]
  ) => void;
  tickOffIngredient: (ingredientName: string) => void;
  reorderDishes: (newOrder: Dish[]) => void;
};

const DishesContext = createContext<DishesContextType | undefined>(undefined);

export const DishesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dishesStack, setDishesStack] = useState<Dish[]>([]);

  // Utility: compute matrix (unchanged)
  const createMatrix = (prepBags: PrepBag[], columnHeight = 8) => {
    const totalCols = Math.ceil(prepBags.length / columnHeight);
    const matrix: Array<Array<PrepBag | null>> = Array.from({ length: columnHeight }, (_, row) =>
      Array.from({ length: totalCols }, (_, col) => prepBags[col * columnHeight + row] || null)
    );
    return matrix;
  };

  const addDish = (
    dish: Omit<Dish, 'id' | 'prepBags' | 'matrix' | 'quantity' | 'completedPrepBags'>,
    quantity: number
  ) => {
    const newDishId = uuidv4();

    const newPrepBags: PrepBag[] = Array.from({ length: quantity }, () => ({
      id: uuidv4(),
      dishName: dish.name,
      ingredients: dish.ingredients,
      addedIngredients: [],
      isComplete: false,
    }));

    const matrix = createMatrix(newPrepBags, 8);

    const newDish: Dish = {
      id: newDishId,
      name: dish.name,
      quantity,
      ingredients: dish.ingredients,
      prepBags: newPrepBags,
      completedPrepBags: [], // Initialize empty
      matrix,
      colour: dish.colour,
    };

    setDishesStack((prev) => [...prev, newDish]);
  };

  const undoDish = () => setDishesStack((prev) => prev.slice(0, -1));
  const clearDishes = () => setDishesStack([]);

  const removeDish = (name: string) =>
    setDishesStack((prev) => prev.filter((dish) => dish.name !== name));

  const updateDish = (name: string, quantity: number, ingredients: Dish['ingredients']) => {
    setDishesStack((prev) =>
      prev.map((dish) => {
        if (dish.name === name) {
          let updatedBags = dish.prepBags;
          if (quantity > dish.prepBags.length) {
            const additionalBags = Array.from({ length: quantity - dish.prepBags.length }, () => ({
              id: uuidv4(),
              dishName: name,
              ingredients,
              addedIngredients: [],
              isComplete: false,
            }));
            updatedBags = [...dish.prepBags, ...additionalBags];
          } else if (quantity < dish.prepBags.length) {
            updatedBags = dish.prepBags.slice(0, quantity);
          }
          const newMatrix = createMatrix(updatedBags, 8);
          return { ...dish, ingredients, prepBags: updatedBags, matrix: newMatrix, quantity };
        }
        return dish;
      })
    );
  };

  // Here we update the targeted prep bag. If it becomes complete, move it into completedPrepBags.
  const updatePrepBag = (
    prepBagId: string,
    newAddedIngredients: { name: string; weight: number; unit: string }[]
  ) => {
    setDishesStack((prev) =>
      prev.map((dish) => ({
        ...dish,
        prepBags: dish.prepBags.map((bag) => {
          if (bag.id === prepBagId) {
            return {
              ...bag,
              addedIngredients: newAddedIngredients,
              isComplete: newAddedIngredients.length === bag.ingredients.length,
            };
          } else {
            return bag;
          }
        }),
      }))
    );
  };

  const tickOffIngredient = (ingredientName: string) => {
    setDishesStack((prev) =>
      prev.map((dish) => {
        const updatedPrepBags = dish.prepBags.map((bag) => {
          if (bag.ingredients.some((ing) => ing.name === ingredientName)) {
            const existing = new Set(bag.addedIngredients.map((i) => i.name));
            if (!existing.has(ingredientName)) {
              return {
                ...bag,
                addedIngredients: [...bag.addedIngredients, { name: ingredientName, weight: 0, unit: '' }],
                isComplete: bag.addedIngredients.length + 1 === bag.ingredients.length,
              };
            }
          }
          return bag;
        });
        return { ...dish, prepBags: updatedPrepBags };
      })
    );
  };

  const reorderDishes = (newOrder: Dish[]) => setDishesStack(newOrder);

  return (
    <DishesContext.Provider
      value={{
        dishesStack,
        addDish,
        undoDish,
        clearDishes,
        removeDish,
        updateDish,
        updatePrepBag,
        tickOffIngredient,
        reorderDishes,
      }}
    >
      {children}
    </DishesContext.Provider>
  );
};

export const useDishesContext = () => {
  const context = useContext(DishesContext);
  if (!context) throw new Error('useDishesContext must be used within a DishesProvider');
  return context;
};
