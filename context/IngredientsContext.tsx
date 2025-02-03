// context/IngredientsContext.tsx
import React, { createContext, useContext, useState, useCallback } from "react";

export type IngredientUpdates = {
  [bagId: string]: {
    pending: Record<string, boolean>;
  };
};

type IngredientsContextType = {
  pendingUpdates: IngredientUpdates;
  updatePending: (bagId: string, ingredientName: string, toAdd: boolean) => void;
  clearPending: (bagId: string) => void;
  confirmUpdates: (
    bagId: string,
    confirmed: string[],
    ingredients: { name: string; weight: number; unit: string }[],
    updatePrepBag: (bagId: string, newAddedIngredients: { name: string; weight: number; unit: string }[]) => void
  ) => void;
  getEffectiveCount: (
    bagId: string,
    confirmed: string[],
    total: number,
    showMissing?: boolean
  ) => number;
};

const IngredientsContext = createContext<IngredientsContextType | undefined>(undefined);

export const IngredientsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingUpdates, setPendingUpdates] = useState<IngredientUpdates>({});

  const updatePending = useCallback(
    (bagId: string, ingredientName: string, toAdd: boolean) => {
      setPendingUpdates(prev => ({
        ...prev,
        [bagId]: {
          pending: {
            ...prev[bagId]?.pending,
            [ingredientName]: toAdd,
          },
        },
      }));
    },
    []
  );

  const clearPending = useCallback((bagId: string) => {
    setPendingUpdates(prev => {
      const { [bagId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const confirmUpdates = useCallback(
    (
      bagId: string,
      confirmed: string[],
      ingredients: { name: string; weight: number; unit: string }[],
      updatePrepBag: (bagId: string, newAddedIngredients: { name: string; weight: number; unit: string }[]) => void
    ) => {
      const pending = pendingUpdates[bagId]?.pending || {};
      const effectiveSet = new Set(confirmed);
      Object.entries(pending).forEach(([ing, toAdd]) => {
        if (toAdd) effectiveSet.add(ing);
        else effectiveSet.delete(ing);
      });
      const effective = Array.from(effectiveSet);
      const newAdded = effective.map(ing => {
        const recipeIngredient = ingredients.find(i => i.name === ing);
        return recipeIngredient || { name: ing, weight: 0, unit: "unitless" };
      });
      updatePrepBag(bagId, newAdded);
      clearPending(bagId);
    },
    [pendingUpdates, clearPending]
  );

  const getEffectiveCount = useCallback(
    (bagId: string, confirmed: string[], total: number, showMissing = false): number => {
      const pending = pendingUpdates[bagId]?.pending || {};
      const effective = new Set(confirmed);
      Object.entries(pending).forEach(([ing, toAdd]) => {
        if (toAdd) effective.add(ing);
        else effective.delete(ing);
      });
      return showMissing ? total - effective.size : effective.size;
    },
    [pendingUpdates]
  );

  return (
    <IngredientsContext.Provider
      value={{ pendingUpdates, updatePending, clearPending, confirmUpdates, getEffectiveCount }}
    >
      {children}
    </IngredientsContext.Provider>
  );
};

export const useIngredientsContext = () => {
  const context = useContext(IngredientsContext);
  if (!context) throw new Error("useIngredientsContext must be used within an IngredientsProvider");
  return context;
};
