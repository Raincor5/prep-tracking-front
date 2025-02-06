// app/advanced-mode/AdvancedMode.tsx
// A screen that displays draggable dishes with prep bags.
// Purpose: This screen allows users to drag dishes with prep bags and select ingredients to confirm.
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import DraggableDish from "@/app/advanced-mode/DraggableDish";
import { useDishesContext } from "@/context/DishesContext";
import { useIngredientsContext } from "@/context/IngredientsContext";
import { IngredientChip } from "./IngredientChip"; // Adjust the path if needed
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useGestureManager } from "@/context/GestureManagerContext";

// Utility: Create a matrix from an array of prepBags.
const createMatrix = (prepBags: any[], columnHeight = 8) => {
  const totalCols = Math.ceil(prepBags.length / columnHeight);
  return Array.from({ length: columnHeight }, (_, row) =>
    Array.from({ length: totalCols }, (_, col) => prepBags[col * columnHeight + row] || null)
  );
};

// Helper function: Determine if an ingredient is exhausted across all dishes.
const isIngredientExhausted = (ingredient: string, dishesStack: any[]): boolean => {
  let required = 0;
  let confirmed = 0;
  dishesStack.forEach((dish) => {
    if (dish.ingredients.some((ing: any) => ing.name === ingredient)) {
      required += dish.prepBags.length;
      dish.prepBags.forEach((bag: any) => {
        if (bag && bag.addedIngredients.some((ai: any) => ai.name === ingredient)) {
          confirmed++;
        }
      });
    }
  });
  return required > 0 && confirmed >= required;
};

export default function AdvancedModeScreen() {
  const insets = useSafeAreaInsets();
  const { dishesStack, reorderDishes, updatePrepBag } = useDishesContext();
  const { updatePending, confirmUpdates, getEffectiveCount } = useIngredientsContext();
  const [focusedIndices, setFocusedIndices] = useState<number[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [frozenIngredientOrder, setFrozenIngredientOrder] = useState<string[] | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const ingredientScrollRef = useRef<ScrollView>(null);

  // Create a ref for the flat list to allow simultaneous gesture handling.
  const flatListRef = useRef(null);

  // Use the gesture manager from context.
  const { isSwipeEnabled, isScrollEnabled, setGestureState } = useGestureManager();

  // Update gesture manager state when selected ingredients change.
  useEffect(() => {
    setGestureState(selectedIngredients);
  }, [selectedIngredients, setGestureState]);

  const onBagPress = useCallback(
    (dishId: string, bagId: string) => {
      const dish = dishesStack.find((d) => d.id === dishId);
      if (!dish) return;
      const bag = dish.prepBags.find((b: any) => b && b.id === bagId);
      if (!bag) return;
      const allowed = new Set(dish.ingredients.map((ing: any) => ing.name));
      selectedIngredients.forEach((ing) => {
        if (!allowed.has(ing)) return;
        const confirmed = bag.addedIngredients.some((ai: any) => ai.name === ing);
        updatePending(bagId, ing, !confirmed);
      });
    },
    [dishesStack, selectedIngredients, updatePending]
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    const indices = viewableItems
      .map((item) => item.index)
      .filter((i): i is number => i !== null && i !== undefined);
    setFocusedIndices(indices);
  }).current;

  const viewabilityConfig = useMemo(() => ({ viewAreaCoveragePercentThreshold: 50 }), []);

  const focusedDishes = useMemo(
    () => focusedIndices.map((i) => dishesStack[i]).filter(Boolean),
    [focusedIndices, dishesStack]
  );

  const frequencyMap = useMemo(() => {
    const map: Record<string, number> = {};
    dishesStack.forEach((dish) => {
      dish.ingredients.forEach((ingredient: any) => {
        map[ingredient.name] = (map[ingredient.name] || 0) + 1;
      });
    });
    return map;
  }, [dishesStack]);

  useEffect(() => {
    if (selectedIngredients.length > 0 && !frozenIngredientOrder) {
      const focusedSet = new Set<string>();
      focusedDishes.forEach((dish) =>
        dish.ingredients.forEach((ingredient: any) => focusedSet.add(ingredient.name))
      );
      const sorted = Object.keys(frequencyMap).sort((a, b) => {
        const aFocused = focusedSet.has(a) ? 1 : 0;
        const bFocused = focusedSet.has(b) ? 1 : 0;
        if (aFocused !== bFocused) return bFocused - aFocused;
        return frequencyMap[b] - frequencyMap[a];
      });
      setFrozenIngredientOrder(sorted);
    }
    if (selectedIngredients.length === 0 && frozenIngredientOrder) {
      setFrozenIngredientOrder(null);
    }
  }, [selectedIngredients, frequencyMap, focusedDishes, frozenIngredientOrder]);

  const allIngredients = useMemo(() => {
    const ingredients = frozenIngredientOrder ? [...frozenIngredientOrder] : Object.keys(frequencyMap);
    // Sort so that non-exhausted ingredients come first.
    ingredients.sort((a, b) => {
      const aEx = isIngredientExhausted(a, dishesStack) ? 1 : 0;
      const bEx = isIngredientExhausted(b, dishesStack) ? 1 : 0;
      if (aEx !== bEx) return aEx - bEx; // non-exhausted first
      return frequencyMap[b] - frequencyMap[a];
    });
    return ingredients;
  }, [frequencyMap, focusedDishes, frozenIngredientOrder, dishesStack]);

  useEffect(() => {
    ingredientScrollRef.current?.scrollTo({ x: 0, animated: true });
  }, [allIngredients]);

  const toggleIngredient = useCallback((name: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((ing) => ing !== name) : [...prev, name]
    );
  }, []);

  // Disable dish dragging when ingredients are selected so that swipe gesture on bag cells takes priority.
  const disableDrag = selectedIngredients.length > 0;

  const confirmAllUpdates = useCallback(() => {
    dishesStack.forEach((dish) => {
      dish.prepBags.forEach((bag: any) => {
        if (!bag) return;
        const effectiveCount = getEffectiveCount(
          bag.id,
          bag.addedIngredients.map((ai: any) => ai.name),
          bag.ingredients.length,
          showMissing
        );
        if (effectiveCount !== bag.addedIngredients.length) {
          confirmUpdates(
            bag.id,
            bag.addedIngredients.map((ai: any) => ai.name),
            bag.ingredients,
            updatePrepBag
          );
        }
      });
    });
    setSelectedIngredients([]);
  }, [dishesStack, getEffectiveCount, confirmUpdates, updatePrepBag, showMissing]);

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<typeof dishesStack[0]>) => {
      const matrix = createMatrix(item.prepBags, 8);
      return (
        <TouchableOpacity
          onLongPress={!disableDrag ? drag : undefined}
          disabled={isActive || disableDrag}
          style={[styles.dishItem, { opacity: isActive ? 0.8 : 1 }]}
        >
          <DraggableDish
            dishId={item.id}
            label={item.name}
            matrix={matrix}
            colour={item.colour}
            editable={disableDrag}
            onBagPress={(bagId: string) => onBagPress(item.id, bagId)}
            selectedIngredients={selectedIngredients}
            isSwipeEnabled={isSwipeEnabled}
          />
        </TouchableOpacity>
      );
    },
    [disableDrag, onBagPress, dishesStack, selectedIngredients, isSwipeEnabled]
  );

  return (
    // Wrap the screen in GestureHandlerRootView; GestureManagerProvider should be set higher in the tree.
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        <SafeAreaProvider>
          <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]} edges={["left", "right", "bottom"]}>
            <ScrollView
              ref={ingredientScrollRef}
              horizontal
              contentContainerStyle={styles.ingredientBarContent}
              style={styles.ingredientBar}
              showsHorizontalScrollIndicator={false}
              scrollEnabled={true}
            >
              {allIngredients.length === 0 ? (
                <Text style={styles.emptyIngredientsText}>No ingredients</Text>
              ) : (
                allIngredients.map((name) => (
                  <IngredientChip
                    key={name}
                    name={name}
                    selected={selectedIngredients.includes(name)}
                    onToggle={() => toggleIngredient(name)}
                    exhausted={isIngredientExhausted(name, dishesStack)}
                  />
                ))
              )}
            </ScrollView>
            {disableDrag && (
              <TouchableOpacity style={styles.confirmButton} onPress={confirmAllUpdates}>
                <Text style={styles.confirmButtonText}>Confirm Ingredients</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.listContainer, { height: Dimensions.get("window").height * 0.7 }]}>
              <DraggableFlatList
                ref={flatListRef}
                data={dishesStack}
                keyExtractor={(dish) => dish.id}
                renderItem={renderItem}
                onDragEnd={({ data }) => reorderDishes(data)}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                horizontal
                initialNumToRender={3}
                windowSize={5}
                contentContainerStyle={styles.listContent}
                scrollEnabled={isScrollEnabled}
              />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#121212", paddingTop: 0 },
  container: { flex: 1, paddingHorizontal: 10 },
  ingredientBar: { marginBottom: 2 },
  ingredientBarContent: { alignItems: "center", paddingHorizontal: 5 },
  emptyIngredientsText: { color: "#fff", marginLeft: 10 },
  listContainer: { height: Dimensions.get("window").height * 0.7 },
  listContent: { paddingVertical: 0 },
  dishItem: { marginRight: 5 },
  confirmButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 5,
  },
  confirmButtonText: { color: "#fff", fontWeight: "bold" },
});
