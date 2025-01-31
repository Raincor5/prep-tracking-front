// screens/advanced-mode.tsx

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useRouter } from 'expo-router';
import { useDishesContext } from '@/context/DishesContext';
import { Dish } from '@/types/dish'; // Ensure 'id' is included in this interface
import * as ScreenOrientation from 'expo-screen-orientation';
import { groupPrepBags } from '@/utils/groupPrepBags'; // Import the grouping utility

/**
 * AdvancedMode Screen
 * Manages prep bags with ingredient selection and grouping.
 */
const AdvancedMode = () => {
  const router = useRouter();
  const { dishesStack, updatePrepBag, reorderDishes } = useDishesContext();

  // State for selected ingredient and selected prep bags
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [selectedPrepBags, setSelectedPrepBags] = useState<Set<string>>(new Set());

  /**
   * Compile all prep bags from all dishes into a single list.
   */
  const allPrepBags = useMemo(() => {
    return dishesStack.flatMap((dish) => dish.prepBags || []);
  }, [dishesStack]);

  /**
   * Create a list of unique ingredients across all dishes.
   */
  const uniqueIngredients = useMemo(() => {
    const ingredientSet = new Set<string>();
    dishesStack.forEach((dish) => {
      dish.ingredients.forEach((ingredient) => {
        ingredientSet.add(ingredient.name);
      });
    });
    return Array.from(ingredientSet);
  }, [dishesStack]);

  /**
   * Calculate the size of each prep bag square.
   */
  const prepBagSize = useMemo(() => {
    const screenHeight = Dimensions.get('window').height;
    const desiredPrepBagsPerColumn = 8; // Fixed number per column
    const totalSpacing = 16 * (desiredPrepBagsPerColumn + 1); // Spacing between prep bags
    const availableHeight = screenHeight - 200; // Adjusted based on screen height
    return (availableHeight - totalSpacing) / desiredPrepBagsPerColumn;
  }, []);

  /**
   * Handle drag end for DraggableFlatList (reordering dishes).
   */
  const handleDragEnd = useCallback(({ data }: { data: Dish[] }) => {
    // Update the dishesStack with the new order
    reorderDishes(data);
  }, [reorderDishes]);

  /**
   * Toggle selection of a prep bag.
   */
  const togglePrepBagSelection = useCallback((prepBagId: string) => {
    setSelectedPrepBags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(prepBagId)) {
        newSet.delete(prepBagId);
      } else {
        newSet.add(prepBagId);
      }
      return newSet;
    });
  }, []);

  /**
   * Handle ingredient selection from the top scroll bar.
   */
  const handleIngredientSelection = useCallback((ingredientName: string) => {
    if (selectedIngredient === ingredientName) {
      // Deselect if already selected
      setSelectedIngredient(null);
      setSelectedPrepBags(new Set());
    } else {
      setSelectedIngredient(ingredientName);
      setSelectedPrepBags(new Set());
    }
  }, [selectedIngredient]);

  /**
   * Helper function to calculate prep bag number within a dish.
   * @param dish - The dish containing the prep bag.
   * @param prepBagId - The ID of the prep bag.
   * @returns The prep bag number starting from 1.
   */
  const getPrepBagNumber = useCallback((dish: Dish, prepBagId: string): number => {
    const index = dish.prepBags.findIndex((pb) => pb.id === prepBagId);
    return index !== -1 ? index + 1 : 0; // Assuming prep bags are indexed from 1 upwards
  }, []);

  /**
   * Group prep bags by dish name and their added ingredients similarity.
   * Sort the addedIngredients to ensure order-insensitive grouping.
   */
  const groupedPrepBags = useMemo(() => {
    const groupMap: Record<
      string,
      { bags: string[]; ingredients: string[] }[]
    > = {};

    dishesStack.forEach((dish) => {
      const dishPrepBags = dish.prepBags || [];

      // Group prep bags based on added ingredients
      dishPrepBags.forEach((prepBag) => {
        const prepBagNumber = getPrepBagNumber(dish, prepBag.id);

        // Sort the addedIngredients alphabetically by name
        const sortedAddedIngredients = [...prepBag.addedIngredients].sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        // Generate a key based on the sorted ingredient names
        const ingredientsKey = sortedAddedIngredients
          .map((ing) => ing.name)
          .join(',');

        if (!groupMap[dish.name]) {
          groupMap[dish.name] = [];
        }

        // Check if a group with the same ingredientsKey exists
        const existingGroup = groupMap[dish.name].find(
          (group) => group.ingredients.join(',') === ingredientsKey
        );

        if (existingGroup) {
          existingGroup.bags.push(prepBagNumber.toString());
        } else {
          const ingredientList =
            ingredientsKey === ''
              ? ['** EMPTY **']
              : sortedAddedIngredients.map((ing) => ing.name);
          groupMap[dish.name].push({
            bags: [prepBagNumber.toString()],
            ingredients: ingredientList,
          });
        }
      });
    });

    // Convert groupMap to an array for FlatList
    const groupArray: {
      dishName: string;
      prepBags: { bags: string[]; ingredients: string[] }[];
    }[] = [];

    Object.entries(groupMap).forEach(([dishName, prepBags]) => {
      groupArray.push({
        dishName,
        prepBags,
      });
    });

    return groupArray;
  }, [dishesStack, getPrepBagNumber]);

  /**
   * Render each grouped prep bag under its dish.
   */
  const renderGroupedPrepBags = useCallback(
    ({
      item,
    }: {
      item: { dishName: string; prepBags: { bags: string[]; ingredients: string[] }[] };
    }) => {
      const { dishName, prepBags } = item;

      return (
        <View style={styles.groupedPrepBagsContainer}>
          <Text style={styles.groupedIngredientsTitle}>{dishName}</Text>
          {prepBags.map((prepBagGroup, index) => (
            <View key={index} style={styles.prepBagGroup}>
              <Text style={styles.prepBagBagsText}>
                Bags: {prepBagGroup.bags.join(', ')}
              </Text>
              {prepBagGroup.ingredients.map((ing, idx) => (
                <Text key={idx} style={styles.prepBagIngredientText}>
                  - {ing}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    },
    []
  );

  /**
   * Render each dish as a draggable item with its prep bags arranged in a vertical stack.
   */
  const renderDish = useCallback(({ item, drag, isActive }: RenderItemParams<Dish>) => {
    return (
      <TouchableOpacity
        style={[
          styles.dishContainer,
          { backgroundColor: isActive ? '#333' : '#1e1e1e' },
        ]}
        onLongPress={drag}
        activeOpacity={1}
        accessibilityLabel={`Drag and reorder dish ${item.name}`}
        accessibilityRole="button"
      >
        {/* Dish Title */}
        <Text style={styles.dishTitle}>{item.name}</Text>

        {/* Prep Bags Vertical Stack */}
        <FlatList
          data={item.prepBags}
          keyExtractor={(prepBag) => prepBag.id}
          renderItem={({ item: prepBag }) => {
            const prepBagNumber = getPrepBagNumber(item, prepBag.id);
            const isSelected = selectedPrepBags.has(prepBag.id);
            const isFilled = prepBag.isComplete;

            return (
              <TouchableOpacity
                style={[
                  styles.prepBagSquare,
                  { width: prepBagSize, height: prepBagSize },
                  isSelected && styles.prepBagSelected,
                  isFilled && styles.prepBagFilled,
                ]}
                onPress={() => {
                  if (isFilled) return; // Do nothing if the prep bag is filled
                  togglePrepBagSelection(prepBag.id);
                }}
                disabled={isFilled} // Disable interaction if filled
                accessibilityLabel={`Select prep bag ${prepBagNumber} for ${item.name}`}
                accessibilityRole="button"
              >
                <Text style={styles.prepBagNumber}>{prepBagNumber}</Text>
                {isFilled && <Text style={styles.checkmark}>✔</Text>}
              </TouchableOpacity>
            );
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false} // Disable scrolling within prep bags
        />
      </TouchableOpacity>
    );
  }, [getPrepBagNumber, prepBagSize, selectedPrepBags, togglePrepBagSelection]);

  /**
   * Handle adding selected ingredient to selected prep bags.
   */
  const handleConfirmAddition = useCallback(() => {
    if (!selectedIngredient) {
      Alert.alert('No Ingredient Selected', 'Please select an ingredient to add.');
      return;
    }

    if (selectedPrepBags.size === 0) {
      Alert.alert('No Prep Bags Selected', 'Please select at least one prep bag.');
      return;
    }

    const completedBags: string[] = [];
    const addedBags: string[] = [];

    selectedPrepBags.forEach((prepBagId) => {
      const prepBag = allPrepBags.find((pb) => pb.id === prepBagId);
      if (!prepBag) return;

      const existingAddedIngredients = new Set(prepBag.addedIngredients.map((ing) => ing.name));

      if (!existingAddedIngredients.has(selectedIngredient)) {
        const newAddedIngredient = prepBag.ingredients.find(
          (ing) => ing.name === selectedIngredient
        );

        if (newAddedIngredient) {
          const updatedAddedIngredients = [
            ...prepBag.addedIngredients,
            {
              name: newAddedIngredient.name,
              weight: newAddedIngredient.weight,
              unit: newAddedIngredient.unit,
            },
          ];

          updatePrepBag(prepBagId, updatedAddedIngredients);

          // Determine dish name and calculate prepBagNumber
          const dish = dishesStack.find((d) => d.prepBags?.some((pb) => pb.id === prepBagId));
          if (dish) {
            const prepBagNum = getPrepBagNumber(dish, prepBagId);
            if (updatedAddedIngredients.length === prepBag.ingredients.length) {
              completedBags.push(`Prep Bag ${prepBagNum} for ${dish.name}`);
            } else {
              addedBags.push(`Prep Bag ${prepBagNum} for ${dish.name}`);
            }
          } else {
            addedBags.push(`Prep Bag Unknown for Unknown Dish`);
          }
        }
      }
    });

    let message = '';
    if (addedBags.length > 0) {
      message += `Added "${selectedIngredient}" to:\n${addedBags.join('\n')}\n\n`;
    }
    if (completedBags.length > 0) {
      message += `Completed:\n${completedBags.join('\n')}`;
    }

    Alert.alert('Ingredients Added', message.trim());

    // Clear selections after confirmation
    setSelectedIngredient(null);
    setSelectedPrepBags(new Set());
  }, [selectedIngredient, selectedPrepBags, allPrepBags, updatePrepBag, dishesStack, getPrepBagNumber]);

  /**
   * Effect to lock screen orientation to landscape.
   */
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        {/* Left Section: Two-Thirds Width */}
        <View style={styles.leftSection}>
          {/* Back Button and Title */}
          <View style={styles.headerContainer}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityLabel="Go back to the previous screen"
              accessibilityRole="button"
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <Text style={styles.title}>All Prep Bags</Text>
          </View>

          {/* Ingredient Selection Bar */}
          <View style={styles.ingredientsScrollContainer}>
            <FlatList
              data={uniqueIngredients}
              keyExtractor={(item) => item}
              horizontal
              renderItem={({ item }) => {
                const isSelected = selectedIngredient === item;
                return (
                  <Pressable
                    style={[
                      styles.ingredientItem,
                      isSelected && styles.ingredientItemSelected,
                    ]}
                    onPress={() => handleIngredientSelection(item)}
                    accessibilityLabel={`Select ingredient ${item}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.ingredientText}>{item}</Text>
                  </Pressable>
                );
              }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ingredientsFlatList}
            />
          </View>

          {/* ScrollView Wrapping DraggableFlatList */}
          <ScrollView
            horizontal
            contentContainerStyle={styles.draggableListScrollViewContent}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <DraggableFlatList
              data={dishesStack}
              keyExtractor={(item) => item.id}
              renderItem={renderDish}
              onDragEnd={handleDragEnd}
              activationDistance={10}
              horizontal={true} // Disable horizontal scrolling inside DraggableFlatList
              showsVerticalScrollIndicator={false}
              containerStyle={styles.draggableListContainer}
              contentContainerStyle={styles.draggableListContent}
            />
          </ScrollView>
        </View>

        {/* Right Section: One-Third Width */}
        <View style={styles.rightSection}>
          {/* Grouped Prep Bags Sidebar */}
          <ScrollView contentContainerStyle={styles.groupedIngredientsList}>
            <Text style={styles.groupedIngredientsTitle}>
              Grouped Prep Bags
            </Text>
            {groupedPrepBags.length === 0 ? (
              <Text style={styles.noSelectionText}>
                No prep bags to display.
              </Text>
            ) : (
              <FlatList
                data={groupedPrepBags}
                keyExtractor={(item, index) => `${item.dishName}-${item.prepBags.length}-${index}`}
                renderItem={renderGroupedPrepBags}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.groupedPrepBagsContainer}
              />
            )}
          </ScrollView>

          {/* Confirm Addition Button */}
          <View style={styles.confirmButtonContainer}>
            <Pressable
              style={[
                styles.confirmButton,
                (!selectedIngredient || selectedPrepBags.size === 0) &&
                  styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirmAddition}
              disabled={!selectedIngredient || selectedPrepBags.size === 0}
              accessibilityLabel="Confirm adding selected ingredient to selected prep bags"
              accessibilityRole="button"
            >
              <Text style={styles.confirmButtonText}>Confirm Addition</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AdvancedMode;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
  },
  /* Left Section Styles */
  leftSection: {
    flex: 2, // Two-thirds width
    flexDirection: 'column',
    marginRight: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginRight: 10,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  ingredientsScrollContainer: {
    height: 50,
    marginBottom: 10,
  },
  ingredientsFlatList: {
    alignItems: 'center',
    paddingHorizontal: 8, // Added padding for better alignment
  },
  ingredientItem: {
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  ingredientItemSelected: {
    backgroundColor: '#4CAF50',
  },
  ingredientText: {
    color: '#fff',
    fontSize: 14,
  },
  /* Draggable List Styles */
  draggableListScrollViewContent: {
    flexDirection: 'row',
  },
  draggableListContainer: {
    // flex: 1, // Removed flex to allow ScrollView to handle sizing
    marginTop: 10,
  },
  draggableListContent: {
    // Adjust content container as needed
  },
  /* Dish Container Styles */
  dishContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 8, // Reduced padding for minimal space
    marginRight: 16, // Space between dishes
    width: 250, // Fixed width to prevent wrapping
  },
  dishTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  /* Prep Bags Vertical Stack Styles */
  prepBagsStack: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  prepBagSquare: {
    backgroundColor: '#1e1e1e',
    borderRadius: 5,
    marginVertical: 4, // Space between prep bags vertically
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  prepBagSelected: {
    backgroundColor: '#2196F3',
  },
  prepBagFilled: {
    backgroundColor: '#555', // Greyed-out
  },
  prepBagNumber: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkmark: {
    position: 'absolute',
    top: 2,
    right: 4,
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  /* Right Section Styles */
  rightSection: {
    flex: 1, // One-third width
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  groupedIngredientsList: {
    paddingHorizontal: 8, // Added padding for better alignment
  },
  groupedPrepBagsContainer: {
    // Optional: Add background color or other styles if needed
  },
  groupedIngredientsTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  noSelectionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  prepBagGroup: {
    marginBottom: 10,
  },
  prepBagBagsText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 10,
    marginBottom: 2,
  },
  prepBagIngredientText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 20,
  },
  /* Confirm Button Styles */
  confirmButtonContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 5,
  },
  confirmButtonDisabled: {
    backgroundColor: '#888',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
