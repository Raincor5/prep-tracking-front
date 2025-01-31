// context/RecipeContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import apiEndpoints from "@/constants/apiConfig";
import { Recipe } from "@/types/recipe";

type RecipeContextType = {
  recipes: Recipe[];
  fetchRecipes: () => Promise<void>;
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
};

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

export const RecipeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const fetchRecipes = async () => {
    try {
      const response = await fetch(apiEndpoints.recipes);
      if (!response.ok) {
        throw new Error("Failed to fetch recipes.");
      }
      const data = await response.json();
      setRecipes(data);
      console.warn("Fetched recipes:", JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error fetching recipes:", error);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  return (
    <RecipeContext.Provider value={{ recipes, fetchRecipes, setRecipes }}>
      {children}
    </RecipeContext.Provider>
  );
};

export const useRecipeContext = () => {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error("useRecipeContext must be used within a RecipeProvider");
  }
  return context;
};
