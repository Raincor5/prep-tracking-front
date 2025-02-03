// app/advanced-mode/index.tsx
// A screen for the advanced mode of the app.
// Purpose: This screen allows users to view and interact with dishes in a draggable list. Users can select ingredients to view and confirm updates to prep bags.

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
import { ViewToken } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useDishesContext } from "@/context/DishesContext";
import DraggableDish from "@/app/advanced-mode/DraggableDish";
import { useIngredientsContext } from "@/context/IngredientsContext";
import { IngredientChip } from "./IngredientChip"; // adjust the path if needed

// Utility: Create a matrix of prep bags (columns of 8) from an array.
const createMatrix = (prepBags: any[], columnHeight = 8) => {
  const totalCols = Math.ceil(prepBags.length / columnHeight);
  return Array.from({ length: columnHeight }, (_, row) =>
    Array.from({ length: totalCols }, (_, col) => prepBags[col * columnHeight + row] || null)
  );
};

export default function AdvancedMode() {
  const insets = useSafeAreaInsets();
  const { dishesStack, reorderDishes, updatePrepBag } = useDishesContext();
  const { updatePending, confirmUpdates, getEffectiveCount } = useIngredientsContext();
  const [focusedIndices, setFocusedIndices] = useState<number[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [frozenIngredientOrder, setFrozenIngredientOrder] = useState<string[] | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const ingredientScrollRef = useRef<ScrollView>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const indices = viewableItems.map(item => item.index).filter((i): i is number => i !== null && i !== undefined);
    setFocusedIndices(indices);
  }).current;

  const viewabilityConfig = useMemo(() => ({ viewAreaCoveragePercentThreshold: 50 }), []);

  const focusedDishes = useMemo(() => focusedIndices.map(i => dishesStack[i]).filter(Boolean), [focusedIndices, dishesStack]);

  const frequencyMap = useMemo(() => {
    const map: Record<string, number> = {};
    dishesStack.forEach(dish => {
      dish.ingredients.forEach(ingredient => {
        map[ingredient.name] = (map[ingredient.name] || 0) + 1;
      });
    });
    return map;
  }, [dishesStack]);

  // Helper: determine if an ingredient is exhausted across all dishes.
  const isIngredientExhausted = useCallback((ingredientName: string): boolean => {
    let totalRequired = 0;
    let totalConfirmed = 0;
    dishesStack.forEach(dish => {
      if (dish.ingredients.some(ing => ing.name === ingredientName)) {
        totalRequired += dish.prepBags.length;
        dish.prepBags.forEach(bag => {
          if (bag.addedIngredients.some(ai => ai.name === ingredientName)) {
            totalConfirmed++;
          }
        });
      }
    });
    return totalRequired > 0 && totalConfirmed >= totalRequired;
  }, [dishesStack]);

  useEffect(() => {
    if (selectedIngredients.length > 0 && !frozenIngredientOrder) {
      const focusedSet = new Set<string>();
      focusedDishes.forEach(dish => dish.ingredients.forEach(ingredient => focusedSet.add(ingredient.name)));
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
    if (frozenIngredientOrder) return frozenIngredientOrder;
    const sorted = Object.keys(frequencyMap).sort((a, b) => {
      const focusedSet = new Set<string>();
      focusedDishes.forEach(dish => dish.ingredients.forEach(ingredient => focusedSet.add(ingredient.name)));
      const aFocused = focusedSet.has(a) ? 1 : 0;
      const bFocused = focusedSet.has(b) ? 1 : 0;
      if (aFocused !== bFocused) return bFocused - aFocused;
      return frequencyMap[b] - frequencyMap[a];
    });
    return sorted;
  }, [frequencyMap, focusedDishes, frozenIngredientOrder]);

  useEffect(() => {
    ingredientScrollRef.current?.scrollTo({ x: 0, animated: true });
  }, [allIngredients]);

  const toggleIngredient = useCallback((name: string) => {
    setSelectedIngredients(prev =>
      prev.includes(name) ? prev.filter(ing => ing !== name) : [...prev, name]
    );
  }, []);

  const disableDrag = selectedIngredients.length > 0;

  // When a prep bag cell is pressed, update pending updates via IngredientsContext.
  const onBagPress = useCallback(
    (dishId: string, bagId: string) => {
      const dish = dishesStack.find(d => d.id === dishId);
      if (!dish) return;
      const bag = dish.prepBags.find(b => b && b.id === bagId);
      if (!bag) return;
      const allowed = new Set(dish.ingredients.map(ing => ing.name));
      selectedIngredients.forEach(ing => {
        if (!allowed.has(ing)) return;
        const confirmed = bag.addedIngredients.some(ai => ai.name === ing);
        updatePending(bagId, ing, !confirmed);
      });
    },
    [dishesStack, selectedIngredients, updatePending]
  );

  // Confirm updates for all bags that have pending changes.
  const confirmAllUpdates = useCallback(() => {
    dishesStack.forEach(dish => {
      dish.prepBags.forEach(bag => {
        if (!bag) return;
        const effectiveCount = getEffectiveCount(
          bag.id,
          bag.addedIngredients.map(ai => ai.name),
          bag.ingredients.length,
          showMissing
        );
        if (effectiveCount !== bag.addedIngredients.length) {
          // Merge pending updates with confirmed ingredients.
          confirmUpdates(bag.id, bag.addedIngredients.map(ai => ai.name), bag.ingredients, updatePrepBag);
        }
      });
    });
    setSelectedIngredients([]);
  }, [dishesStack, getEffectiveCount, confirmUpdates, updatePrepBag, showMissing]);

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<typeof dishesStack[0]>) => {
      // Derive the matrix at render time from the current prepBags.
      const matrix = createMatrix(item.prepBags, 8);
      return (
        <TouchableOpacity
          onLongPress={!disableDrag ? drag : undefined}
          disabled={isActive || disableDrag}
          style={[styles.dishItem, { opacity: isActive ? 0.8 : 1 }]}
        >
          <DraggableDish
            label={item.name}
            matrix={matrix}  // Pass the computed matrix
            colour={item.colour}
            editable={disableDrag}
            onBagPress={(bagId: string) => onBagPress(item.id, bagId)}
            selectedIngredients={selectedIngredients} // Pass selected ingredients to highlight cells
          />
        </TouchableOpacity>
      );
    },
    [disableDrag, onBagPress, dishesStack, selectedIngredients]
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
          <View style={styles.container}>
            <ScrollView
              ref={ingredientScrollRef}
              horizontal
              contentContainerStyle={styles.ingredientBarContent}
              style={styles.ingredientBar}
              showsHorizontalScrollIndicator={false}
            >
              {allIngredients.length === 0 ? (
                <Text style={styles.emptyIngredientsText}>No ingredients</Text>
              ) : (
                allIngredients.map(name => (
                  <IngredientChip
                    key={name}
                    name={name}
                    selected={selectedIngredients.includes(name)}
                    onToggle={() => toggleIngredient(name)}
                    exhausted={isIngredientExhausted(name)}  // Highlight if exhausted
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
                data={dishesStack}
                keyExtractor={dish => dish.id}
                renderItem={renderItem}
                onDragEnd={({ data }) => reorderDishes(data)}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                horizontal
                initialNumToRender={3}
                windowSize={5}
                contentContainerStyle={styles.listContent}
              />
            </View>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#121212", paddingTop: 0 },
  container: { flex: 1, paddingHorizontal: 10 },
  ingredientBar: { marginBottom: 2 },
  ingredientBarContent: { alignItems: "center", paddingHorizontal: 5 },
  ingredientChip: { backgroundColor: "#333", borderRadius: 16, paddingVertical: 4, paddingHorizontal: 10, marginRight: 5 },
  ingredientChipText: { color: "#fff", fontSize: 14 },
  emptyIngredientsText: { color: "#fff", marginLeft: 10 },
  listContainer: { height: Dimensions.get("window").height * 0.7 },
  listContent: { paddingVertical: 0 },
  dishItem: { marginRight: 5 },
  confirmButton: { backgroundColor: "#4CAF50", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: "center", marginBottom: 5 },
  confirmButtonText: { color: "#fff", fontWeight: "bold" },
});
