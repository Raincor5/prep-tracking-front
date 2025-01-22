import React, { createContext, useContext, useState } from 'react';

export type Dish = {
  name: string;
  ingredients: { name: string; weight: number; unit: string }[];
  quantity: number; // Field to store the prep amount
};

type DishesContextType = {
  dishesStack: Dish[];
  addDish: (dish: Dish, quantity: number) => void; // Accept quantity when adding a dish
  undoDish: () => void;
  clearDishes: () => void;
  removeDish: (name: string) => void; // Remove dish by name
  updateDish: (name: string, quantity: number) => void; // Update dish quantity by name
};

const DishesContext = createContext<DishesContextType | undefined>(undefined);

export const DishesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dishesStack, setDishesStack] = useState<Dish[]>([]);

  const addDish = (dish: Dish, quantity: number) => {
    setDishesStack((prev) => {
      const updatedStack = [...prev, { ...dish, quantity }];
      console.log('Updated Stack:', updatedStack);
      return updatedStack;
    });
  };

  const undoDish = () => setDishesStack((prev) => prev.slice(0, -1));

  const clearDishes = () => setDishesStack([]);

  // Remove dish by name
  const removeDish = (name: string) => {
    setDishesStack((prev) => prev.filter((dish) => dish.name !== name));
  };

  // Update the quantity of a dish by name
  const updateDish = (name: string, quantity: number) => {
    setDishesStack((prev) =>
      prev.map((dish) =>
        dish.name === name ? { ...dish, quantity } : dish
      )
    );
  };

  return (
    <DishesContext.Provider value={{ dishesStack, addDish, undoDish, clearDishes, removeDish, updateDish }}>
      {children}
    </DishesContext.Provider>
  );
};

export const useDishesContext = () => {
  const context = useContext(DishesContext);
  if (!context) throw new Error('useDishesContext must be used within a DishesProvider');
  return context;
};
