// src/context/GestureManagerContext.tsx
// A context to manage the state and priority of gestures in the app.
// Purpose: This context provides functions to enable/disable swipe-to–add and scrolling.
// Features:
//   - isSwipeEnabled: enables swipe-to–add ingredients when ingredients are selected.
//   - isScrollEnabled: enables list scrolling when no ingredients are selected.
//   - gesturePriority: a simple string ("swipe" or "scroll") indicating which gesture should take precedence.
//   - setGestureState: updates the gesture states based on the selected ingredients.
import React, { createContext, useState, useContext } from "react";

type GestureManagerContextType = {
  isSwipeEnabled: boolean;
  isScrollEnabled: boolean;
  gesturePriority: "swipe" | "scroll";
  setGestureState: (selectedIngredients: string[]) => void;
};

const GestureManagerContext = createContext<GestureManagerContextType | undefined>(undefined);

export const GestureManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSwipeEnabled, setSwipeEnabled] = useState(false);
  const [isScrollEnabled, setScrollEnabled] = useState(true);
  const [gesturePriority, setGesturePriority] = useState<"swipe" | "scroll">("scroll");

  const setGestureState = (selectedIngredients: string[]) => {
    if (selectedIngredients.length > 0) {
      setSwipeEnabled(true);
      setScrollEnabled(false);
      setGesturePriority("swipe");
    } else {
      setSwipeEnabled(false);
      setScrollEnabled(true);
      setGesturePriority("scroll");
    }
  };

  return (
    <GestureManagerContext.Provider value={{ isSwipeEnabled, isScrollEnabled, gesturePriority, setGestureState }}>
      {children}
    </GestureManagerContext.Provider>
  );
};

export const useGestureManager = () => {
  const context = useContext(GestureManagerContext);
  if (!context) {
    throw new Error("useGestureManager must be used within a GestureManagerProvider");
  }
  return context;
};
