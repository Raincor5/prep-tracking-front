// app/context/GestureManagerContext.tsx
// A context to manage the state of gestures in the app.
// Purpose: This context provides functions to enable or disable swipe and scroll gestures in the app.

import React, { createContext, useState, useEffect, useContext } from "react";

type GestureManagerContextType = {
  isSwipeEnabled: boolean;
  isScrollEnabled: boolean;
  setGestureState: (selectedIngredients: string[]) => void;
};

const GestureManagerContext = createContext<GestureManagerContextType | undefined>(undefined);

export const GestureManagerProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [isSwipeEnabled, setSwipeEnabled] = useState(false);
  const [isScrollEnabled, setScrollEnabled] = useState(true);

  // When ingredients are selected, enable swipe (for adding ingredients) and disable scroll.
  // Otherwise, disable swipe and enable scroll.
  const setGestureState = (selectedIngredients: string[]) => {
    if (selectedIngredients.length > 0) {
      setSwipeEnabled(true);
      setScrollEnabled(false);
    } else {
      setSwipeEnabled(false);
      setScrollEnabled(true);
    }
  };

  return (
    <GestureManagerContext.Provider value={{ isSwipeEnabled, isScrollEnabled, setGestureState }}>
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
