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
  Modal,
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
// Import BlurView (make sure to install expo-blur or an equivalent package)
import { BlurView } from "expo-blur";

// Scaling utilities based on device dimensions.
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const guidelineBaseWidth = 350;
const guidelineBaseHeight = 680;
const scale = (size: number) => (SCREEN_WIDTH / guidelineBaseWidth) * size;
const verticalScale = (size: number) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

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
  // NEW: State to track the prep bag whose details should be shown.
  const [activeBagDetails, setActiveBagDetails] = useState<{ dishId: string; bag: any } | null>(null);
  const ingredientScrollRef = useRef<ScrollView>(null);
  const flatListRef = useRef(null);
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
      if (selectedIngredients.length > 0) {
        // When ingredients are selected, toggle pending updates.
        const allowed = new Set(dish.ingredients.map((ing: any) => ing.name));
        selectedIngredients.forEach((ing) => {
          if (!allowed.has(ing)) return;
          const confirmed = bag.addedIngredients.some((ai: any) => ai.name === ing);
          updatePending(bagId, ing, !confirmed);
        });
      } else {
        // Otherwise, show the bag's details in a modal.
        setActiveBagDetails({ dishId, bag });
      }
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
      if (aEx !== bEx) return aEx - bEx;
      return frequencyMap[b] - frequencyMap[a];
    });
    return ingredients;
  }, [frequencyMap, frozenIngredientOrder, dishesStack]);

  useEffect(() => {
    ingredientScrollRef.current?.scrollTo({ x: 0, animated: true });
  }, [allIngredients]);

  const toggleIngredient = useCallback((name: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((ing) => ing !== name) : [...prev, name]
    );
  }, []);

  // Disable dish dragging when ingredients are selected so that swipe gestures on bag cells take priority.
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

  // Render each dish. A dedicated drag handle is provided so that tapping on a prep bag cell isn’t intercepted.
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<typeof dishesStack[0]>) => {
      const matrix = createMatrix(item.prepBags, 8);
      return (
        <View style={[styles.dishItem, { opacity: isActive ? 0.8 : 1 }]}>
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
          {!disableDrag && (
            <TouchableOpacity style={styles.dragHandle} onLongPress={drag}>
              <Text style={styles.dragHandleText}>≡</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [disableDrag, onBagPress, selectedIngredients, isSwipeEnabled]
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
          edges={["top", "left", "right", "bottom"]}
        >
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.headerContainer}>
              <Text style={styles.modalTitle}>Advanced Mode</Text>
              <View style={styles.modalDivider} />
            </View>
            {/* Ingredients */}
            <View style={styles.ingredientContainer}>
              <Text style={styles.ingredientTitle}>Select Ingredients</Text>
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
                      exhausted={isIngredientExhausted(name, dishesStack)}
                    />
                  ))
                )}
              </ScrollView>
            </View>
            {/* Draggable Dishes List */}
            <View style={styles.listContainer}>
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
          </View>
          {/* Confirmation Button */}
          {disableDrag && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.confirmButton} onPress={confirmAllUpdates}>
                <Text style={styles.confirmButtonText}>Confirm Ingredients</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Ingredient Showcase Modal for Prep Bag Details */}
          {activeBagDetails && (
            <Modal
              visible={true}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setActiveBagDetails(null)}
            >
              <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalHeaderText}>Prep Bag Details</Text>
                  <ScrollView style={styles.modalScroll}>
                    {activeBagDetails.bag.ingredients.map((ing: any) => {
                      const isAdded = activeBagDetails.bag.addedIngredients.some(
                        (ai: any) => ai.name === ing.name
                      );
                      return (
                        <View key={ing.name} style={styles.ingredientRow}>
                          <Text style={[styles.ingredientName, isAdded && styles.ingredientAdded]}>
                            {ing.name}: {ing.weight} {ing.unit} {isAdded ? "(Added)" : "(Missing)"}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity style={styles.closeButton} onPress={() => setActiveBagDetails(null)}>
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </Modal>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#121212" },
  safeArea: { flex: 1, backgroundColor: "#121212" },
  modalContainer: { flex: 1, paddingHorizontal: scale(16), paddingBottom: verticalScale(8) },
  headerContainer: { paddingVertical: verticalScale(6), alignItems: "center" },
  modalTitle: { color: "#fff", fontSize: moderateScale(20), fontWeight: "700" },
  modalDivider: { width: "90%", height: verticalScale(1), backgroundColor: "#555", marginTop: verticalScale(4) },
  ingredientContainer: { marginVertical: verticalScale(5) },
  ingredientTitle: { color: "#fff", fontSize: moderateScale(16), fontWeight: "600", marginBottom: verticalScale(4), marginHorizontal: scale(4) },
  ingredientBar: { marginBottom: verticalScale(6) },
  ingredientBarContent: { alignItems: "center", paddingHorizontal: scale(4) },
  emptyIngredientsText: { color: "#fff", marginLeft: scale(8) },
  listContainer: { flex: 1 },
  listContent: { paddingVertical: verticalScale(6) },
  // Define dishItem once:
  dishItem: { marginRight: scale(6), position: "relative" },
  dragHandle: { position: "absolute", top: scale(4), right: scale(4), padding: scale(4), backgroundColor: "#333", borderRadius: scale(4) },
  dragHandleText: { color: "#fff", fontSize: moderateScale(14) },
  buttonContainer: { paddingHorizontal: scale(16), paddingVertical: verticalScale(8), backgroundColor: "#121212" },
  confirmButton: { backgroundColor: "#4CAF50", paddingVertical: verticalScale(10), paddingHorizontal: scale(20), borderRadius: moderateScale(8), alignSelf: "center" },
  confirmButtonText: { color: "#fff", fontWeight: "bold", fontSize: moderateScale(16) },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalContent: { width: "80%", maxHeight: "70%", backgroundColor: "rgba(0,0,0,0.8)", borderRadius: scale(8), padding: scale(16) },
  modalHeaderText: { fontSize: moderateScale(18), fontWeight: "bold", marginBottom: verticalScale(8), textAlign: "center", color: "#fff" },
  modalScroll: { marginBottom: verticalScale(8) },
  ingredientRow: { paddingVertical: verticalScale(4), borderBottomWidth: 1, borderBottomColor: "#555" },
  ingredientName: { fontSize: moderateScale(16), color: "#fff" },
  ingredientAdded: { color: "green" },
  closeButton: { alignSelf: "center", backgroundColor: "#4CAF50", paddingVertical: verticalScale(8), paddingHorizontal: scale(16), borderRadius: scale(4) },
  closeButtonText: { color: "#fff", fontSize: moderateScale(16), fontWeight: "bold" },
  advancedModeSection: { marginTop: 30, paddingHorizontal: 10, alignItems: "center" },
  advancedModeButton: { backgroundColor: "#FF5722", paddingVertical: 12, paddingHorizontal: 25, borderRadius: 5 },
  advancedModeButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
}) as any;


