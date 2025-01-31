// context/DishesContext.tsx

import React, { createContext, useContext, useState } from 'react';
import { Dish } from '@/types/dish';
import { PrepBag } from '@/types/prepBags';
import { nanoid as uuidv4 } from 'nanoid/non-secure';

type DishesContextType = {
  dishesStack: Dish[];
  addDish: (dish: Omit<Dish, 'id' | 'prepBags' | 'matrix'| 'quantity'>, quantity: number) => void;
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

  /**
   * Create a matrix where **each column** holds up to 8 prep bags.
   * i.e. for 16 bags, you'll have 2 columns of 8 rows each.
   */
  const createMatrix = (prepBags: PrepBag[], columnHeight = 8) => {
    // number of columns needed
    const totalCols = Math.ceil(prepBags.length / columnHeight);

    // matrix[colIndex] = array of up to 8 prepBags in that column
    // But we'll store it as matrix[row][col] for easy <View>-rows below:
    // => shape: 8 rows x totalCols columns
    // So matrix[row][col] = prepBags[col*columnHeight + row]
    const matrix: Array<Array<PrepBag | null>> = Array.from(
      { length: columnHeight },
      (_, row) => {
        return Array.from({ length: totalCols }, (_, col) => {
          const index = col * columnHeight + row;
          return prepBags[index] || null;
        });
      }
    );
    return matrix;
  };

  const addDish = (
    dish: Omit<Dish, 'id' | 'prepBags' | 'matrix'| 'quantity'>,
    quantity: number
  ) => {
    const newDishId = uuidv4();

    // Create 'quantity' prep bags
    const newPrepBags: PrepBag[] = Array.from({ length: quantity }, () => ({
      id: uuidv4(),
      dishName: dish.name,
      ingredients: dish.ingredients,
      addedIngredients: [],
      isComplete: false,
    }));

    // Build the “column-first” matrix of prepBags
    const matrix = createMatrix(newPrepBags, 8);

    const newDish: Dish = {
      id: newDishId,
      name: dish.name,
      quantity: quantity,
      ingredients: dish.ingredients,
      prepBags: newPrepBags,
      matrix,
      colour: dish.colour,
    };

    setDishesStack((prev) => {
      const updatedStack = [...prev, newDish];
      console.log(`[Dish Added] Name: ${newDish.name}, Quantity: ${quantity}`);
      return updatedStack;
    });
  };

  const undoDish = () => setDishesStack((prev) => prev.slice(0, -1));
  const clearDishes = () => setDishesStack([]);
  const removeDish = (name: string) => {
    setDishesStack((prev) => prev.filter((dish) => dish.name !== name));
  };

  const updateDish = (
    name: string,
    quantity: number,
    ingredients: Dish['ingredients']
  ) => {
    setDishesStack((prev) =>
      prev.map((dish) => {
        if (dish.name === name) {
          let updatedBags = dish.prepBags;

          if (quantity > dish.prepBags.length) {
            const additionalBags = Array.from(
              { length: quantity - dish.prepBags.length },
              () => ({
                id: uuidv4(),
                dishName: name,
                ingredients,
                addedIngredients: [],
                isComplete: false,
              })
            );
            updatedBags = [...dish.prepBags, ...additionalBags];
          } else if (quantity < dish.prepBags.length) {
            updatedBags = dish.prepBags.slice(0, quantity);
          }

          // Optionally regenerate matrix if changed:
          const newMatrix = createMatrix(updatedBags, 8);

          return {
            ...dish,
            ingredients,
            prepBags: updatedBags,
            matrix: newMatrix,
            quantity,
          };
        }
        return dish;
      })
    );
  };

  const updatePrepBag = (
    prepBagId: string,
    newAddedIngredients: { name: string; weight: number; unit: string }[]
  ) => {
    setDishesStack((prev) =>
      prev.map((dish) => ({
        ...dish,
        prepBags: dish.prepBags.map((bag) =>
          bag.id === prepBagId
            ? {
                ...bag,
                addedIngredients: newAddedIngredients,
                isComplete:
                  newAddedIngredients.length === bag.ingredients.length,
              }
            : bag
        ),
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
                addedIngredients: [
                  ...bag.addedIngredients,
                  { name: ingredientName, weight: 0, unit: '' },
                ],
                isComplete:
                  bag.addedIngredients.length + 1 === bag.ingredients.length,
              };
            }
          }
          return bag;
        });
        return { ...dish, prepBags: updatedPrepBags };
      })
    );
  };

  const reorderDishes = (newOrder: Dish[]) => {
    setDishesStack(newOrder);
  };

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
  if (!context)
    throw new Error('useDishesContext must be used within a DishesProvider');
  return context;
};
