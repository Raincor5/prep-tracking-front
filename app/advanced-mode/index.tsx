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

// A chip component to show an ingredient and toggle its selection.
function IngredientChip({
  name,
  selected,
  onToggle,
}: {
  name: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity onPress={onToggle}>
      <View style={[styles.ingredientChip, selected && { backgroundColor: "#4CAF50" }]}>
        <Text style={styles.ingredientChipText}>{name}</Text>
      </View>
    </TouchableOpacity>
  );
}

// For each bag id, maps ingredient name to a boolean flag.
type PendingUpdate = Record<string, boolean>;

export default function AdvancedMode() {
  const insets = useSafeAreaInsets();
  const { dishesStack, addDish, reorderDishes, updatePrepBag } = useDishesContext();
  const [focusedIndices, setFocusedIndices] = useState<number[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  // pendingUpdates maps bag id to pending updates.
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, PendingUpdate>>({});
  const [frozenIngredientOrder, setFrozenIngredientOrder] = useState<string[] | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const ingredientScrollRef = useRef<ScrollView>(null);

  // Track which dish indices are visible.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const indices = viewableItems
      .map((item) => item.index)
      .filter((i): i is number => i !== null && i !== undefined);
    setFocusedIndices(indices);
  }).current;

  const viewabilityConfig = useMemo(() => ({ viewAreaCoveragePercentThreshold: 50 }), []);

  const focusedDishes = useMemo(() => {
    return focusedIndices.map((i) => dishesStack[i]).filter(Boolean);
  }, [focusedIndices, dishesStack]);

  // Precompute frequency map for all ingredients.
  const frequencyMap = useMemo(() => {
    const map: Record<string, number> = {};
    dishesStack.forEach((dish) => {
      dish.ingredients.forEach((ingredient) => {
        map[ingredient.name] = (map[ingredient.name] || 0) + 1;
      });
    });
    return map;
  }, [dishesStack]);

  // Freeze ingredient order when selection is active.
  useEffect(() => {
    if (selectedIngredients.length > 0 && !frozenIngredientOrder) {
      const focusedSet = new Set<string>();
      focusedDishes.forEach((dish) => {
        dish.ingredients.forEach((ingredient) => focusedSet.add(ingredient.name));
      });
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

  // Determine the full list of ingredients.
  const allIngredients = useMemo(() => {
    if (frozenIngredientOrder) return frozenIngredientOrder;
    const sorted = Object.keys(frequencyMap).sort((a, b) => {
      const focusedSet = new Set<string>();
      focusedDishes.forEach((dish) =>
        dish.ingredients.forEach((ingredient) => focusedSet.add(ingredient.name))
      );
      const aFocused = focusedSet.has(a) ? 1 : 0;
      const bFocused = focusedSet.has(b) ? 1 : 0;
      if (aFocused !== bFocused) return bFocused - aFocused;
      return frequencyMap[b] - frequencyMap[a];
    });
    return sorted;
  }, [frequencyMap, focusedDishes, frozenIngredientOrder]);

  // Scroll ingredient list to the start when it updates.
  useEffect(() => {
    ingredientScrollRef.current?.scrollTo({ x: 0, animated: true });
  }, [allIngredients]);

  const toggleIngredient = useCallback((name: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((ing) => ing !== name) : [...prev, name]
    );
  }, []);

  const disableDrag = selectedIngredients.length > 0;

  // Update pendingUpdates for a given bag.
  const onBagPress = useCallback(
    (dishId: string, bagId: string) => {
      const dish = dishesStack.find((d) => d.id === dishId);
      if (!dish) return;
      const bag = dish.prepBags.find((b) => b && b.id === bagId);
      if (!bag) return;
      // Only allow ingredients that belong to the dish.
      const allowed = new Set(dish.ingredients.map((ing) => ing.name));
      const newUpdate: PendingUpdate = {};
      selectedIngredients.forEach((ing) => {
        if (!allowed.has(ing)) return;
        // Toggle: add if not confirmed, or remove if already confirmed.
        const confirmed = bag.addedIngredients.some((ai) => ai.name === ing);
        newUpdate[ing] = !confirmed;
      });
      setPendingUpdates((prev) => ({
        ...prev,
        [bagId]: { ...prev[bagId], ...newUpdate },
      }));
    },
    [dishesStack, selectedIngredients]
  );


  // Confirm updates and merge pending with confirmed state.
  const confirmUpdates = useCallback(() => {
    Object.entries(pendingUpdates).forEach(([bagId, changes]) => {
      const dish = dishesStack.find((d) =>
        d.prepBags.some((bag) => bag && bag.id === bagId)
      );
      if (!dish) return;
      const bag = dish.prepBags.find((b) => b && b.id === bagId);
      if (!bag) return;
      // Start with confirmed ingredients.
      const effectiveSet = new Set(bag.addedIngredients.map((ai) => ai.name));
      Object.entries(changes).forEach(([ing, toAdd]) => {
        if (toAdd) effectiveSet.add(ing);
        else effectiveSet.delete(ing);
      });
      const effective = Array.from(effectiveSet);
      // Use the recipe-specified ingredient if available.
      const newAdded = effective.map((ing) => {
        const recipeIngredient = bag.ingredients.find((i) => i.name === ing);
        return recipeIngredient || { name: ing, weight: 0, unit: "unitless" };
      });
      updatePrepBag(bagId, newAdded);
    });
    // Delay clearing pending updates to allow state propagation.
    setTimeout(() => {
      setPendingUpdates({});
      setSelectedIngredients([]);
    }, 100);
  }, [pendingUpdates, dishesStack, updatePrepBag]);

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<typeof dishesStack[0]>) => (
      <TouchableOpacity
        onLongPress={!disableDrag ? drag : undefined}
        disabled={isActive || disableDrag}
        style={[styles.dishItem, { opacity: isActive ? 0.8 : 1 }]}
      >
        <DraggableDish
          label={item.name}
          matrix={item.matrix}
          colour={item.colour}
          editable={disableDrag}
          pendingUpdates={pendingUpdates}
          onBagPress={(bagId: string) => onBagPress(item.id, bagId)}
        />
      </TouchableOpacity>
    ),
    [disableDrag, pendingUpdates, onBagPress, dishesStack]
  );

  const windowHeight = Dimensions.get("window").height;
  const listContainerHeight = windowHeight * 0.7;

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
                allIngredients.map((name) => (
                  <IngredientChip
                    key={name}
                    name={name}
                    selected={selectedIngredients.includes(name)}
                    onToggle={() => toggleIngredient(name)}
                  />
                ))
              )}
            </ScrollView>
            {disableDrag && (
              <TouchableOpacity style={styles.confirmButton} onPress={confirmUpdates}>
                <Text style={styles.confirmButtonText}>Confirm Ingredients</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.listContainer, { height: listContainerHeight }]}>
              <DraggableFlatList
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
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 0,
  },
  container: { flex: 1, paddingHorizontal: 10 },
  ingredientBar: { marginBottom: 2 },
  ingredientBarContent: { alignItems: "center", paddingHorizontal: 5 },
  ingredientChip: {
    backgroundColor: "#333",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 5,
  },
  ingredientChipText: { color: "#fff", fontSize: 14 },
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
