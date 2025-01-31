// TabTwoScreen.tsx
import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Pressable,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router'; // Import useRouter for navigation
import { useDishesContext } from '@/context/DishesContext';
import { Dish } from '@/types/dish';

/**
 * Compute the Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  const dp: number[][] = Array.from({ length: lenA + 1 }, () =>
    Array(lenB + 1).fill(0)
  );
  for (let i = 0; i <= lenA; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= lenB; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // Deletion
        dp[i][j - 1] + 1,        // Insertion
        dp[i - 1][j - 1] + cost  // Substitution
      );
    }
  }
  return dp[lenA][lenB];
}

/**
 * Convert Levenshtein distance to a similarity score (0 to 1).
 */
function similarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  const dist = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);
  return 1 - dist / maxLen;
}

/**
 * Try to find a key in acc that is similar enough to ingredientName.
 */
function findSimilarIngredientKey(
  acc: Record<string, { totalWeight: number; unit: string }>,
  ingredientName: string,
  threshold = 0.8
): string | null {
  for (const existingName of Object.keys(acc)) {
    if (similarity(existingName, ingredientName) >= threshold) {
      return existingName;
    }
  }
  return null;
}

/**
 * A simple checkbox component.
 */
const CheckBox = ({
  checked,
  onPress,
}: {
  checked: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} style={styles.checkboxContainer}>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Text style={styles.checkboxMark}>✔</Text>}
    </View>
  </TouchableOpacity>
);

export default function TabTwoScreen() {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const { dishesStack, removeDish, updateDish } = useDishesContext();
  const router = useRouter(); // Initialize router for navigation

  // State for CRUD bottom-sheet (editing a single dish)
  const [editingDish, setEditingDish] = useState<{ name: string; quantity: number } | null>(null);
  const [sheetQuantity, setSheetQuantity] = useState('');

  // State for tick-off functionality: track ticked ingredients for each dish.
  // For 'all' mode, use tickedIngredients; for 'dish' mode, use tickedByDish.
  const [tickedIngredients, setTickedIngredients] = useState<string[]>([]);
  const [tickedByDish, setTickedByDish] = useState<Record<string, string[]>>({});

  // Additional state for tick-off mode and selected dish
  const [tickOffMode, setTickOffMode] = useState<'all' | 'dish' | null>(null);
  const [selectedTickOffDish, setSelectedTickOffDish] = useState<string | null>(null);

  // Bottom-sheet refs
  const crudBottomSheetRef = useRef<BottomSheet>(null);
  const tickOffBottomSheetRef = useRef<BottomSheet>(null);

  const handleSummaryToggle = () => {
    setSummaryExpanded((prev) => !prev);
  };

  /**
   * Compute aggregated ingredients across all dishes.
   * (This aggregated list is still rendered in the summary block.)
   */
  const aggregatedIngredients = dishesStack.reduce(
    (acc, dish) => {
      dish.ingredients.forEach((ingredient) => {
        const totalWeight = ingredient.weight * dish.quantity;
        const similarKey = findSimilarIngredientKey(acc, ingredient.name, 0.8);
        if (similarKey) {
          acc[similarKey].totalWeight += totalWeight;
        } else {
          acc[ingredient.name] = { totalWeight, unit: ingredient.unit || '' };
        }
      });
      return acc;
    },
    {} as Record<string, { totalWeight: number; unit: string }>
  );
  const aggregatedIngredientsArray = Object.entries(aggregatedIngredients);

  /**
   * Create a list of unique ingredients across all dishes.
   */
  const uniqueIngredients = useMemo(() => {
    return Array.from(
      dishesStack.reduce((acc, dish) => {
        dish.ingredients.forEach((ingredient) => {
          if (!acc.has(ingredient.name)) {
            acc.set(ingredient.name, ingredient.unit || '');
          }
        });
        return acc;
      }, new Map<string, string>())
    ).map(([name, unit]) => ({ name, unit }));
  }, [dishesStack]);

  /**
   * Compile all prep bags from all dishes into a single list.
   */
  const allPrepBags = useMemo(() => {
    return dishesStack.flatMap(dish => dish.prepBags || []);
  }, [dishesStack]);

  // Render each dish in the prep list.
  // (A tap opens the CRUD bottom-sheet to edit/remove that dish.)
  const renderDish = ({ item }: { item: Dish }) => (
    <TouchableOpacity style={styles.dishItem} onPress={() => openCrudSheet(item)}>
      <Text style={styles.dishName}>
        {item.name} (x{item.quantity})
      </Text>
    </TouchableOpacity>
  );

  // Render aggregated ingredients in the summary block.
  const renderIngredient = ({
    item,
  }: {
    item: [string, { totalWeight: number; unit: string }];
  }) => {
    const [ingredientName, { totalWeight, unit }] = item;
    return (
      <View style={styles.ingredientItem}>
        <Text style={styles.ingredientText}>
          {ingredientName}: {totalWeight} {unit}
        </Text>
      </View>
    );
  };

  // -------------------------------
  // CRUD Bottom-Sheet for editing a dish (prep bag)
  // -------------------------------
  const openCrudSheet = (dish: Dish) => {
    setEditingDish({ name: dish.name, quantity: dish.quantity });
    setSheetQuantity(String(dish.quantity));
    crudBottomSheetRef.current?.snapToIndex(0);
  };

  const handleSaveEdit = () => {
    const qty = parseInt(sheetQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a valid positive number.");
      return;
    }
    if (editingDish) {
      const dish = dishesStack.find(d => d.name === editingDish.name);
      if (dish) {
        updateDish(editingDish.name, qty, dish.ingredients);
      }
      setEditingDish(null);
      setSheetQuantity('');
      Keyboard.dismiss();
      crudBottomSheetRef.current?.close();
    }
  };

  const handleRemove = () => {
    if (editingDish) {
      removeDish(editingDish.name);
      setEditingDish(null);
      setSheetQuantity('');
      Keyboard.dismiss();
      crudBottomSheetRef.current?.close();
    }
  };

  const handleCancelEdit = () => {
    setEditingDish(null);
    setSheetQuantity('');
    Keyboard.dismiss();
    crudBottomSheetRef.current?.close();
  };
  // -------------------------------
  // End CRUD Bottom-Sheet
  // -------------------------------

  // -------------------------------
  // Tick-Off Functionality: Group ingredients by dish.
  // -------------------------------
  // Toggle ticking for a given ingredient in a given dish group.
  const toggleTickForDish = (dishName: string, ingredientName: string) => {
    setTickedByDish((prev) => {
      const dishTicks = prev[dishName] || [];
      if (dishTicks.includes(ingredientName)) {
        return { ...prev, [dishName]: dishTicks.filter((n) => n !== ingredientName) };
      } else {
        return { ...prev, [dishName]: [...dishTicks, ingredientName] };
      }
    });
  };

  // Toggle ticking for an ingredient in 'all' mode
  const toggleTickOffIngredient = (ingredientName: string) => {
    setTickedIngredients((prev) => {
      if (prev.includes(ingredientName)) {
        return prev.filter((name) => name !== ingredientName);
      } else {
        return [...prev, ingredientName];
      }
    });
  };

  // Render each ingredient in 'all' mode tick-off bottom-sheet
  const renderTickOffIngredient = ({ item }: { item: { name: string; unit: string } }) => {
    return (
      <View style={styles.tickOffRow}>
        <CheckBox
          checked={tickedIngredients.includes(item.name)}
          onPress={() => toggleTickOffIngredient(item.name)}
        />
        <Text style={styles.tickOffText}>
          {item.name}
        </Text>
      </View>
    );
  };

  // Render each dish group in the tick-off bottom-sheet for 'dish' mode.
  const renderTickOffDishGroup = ({ item }: { item: Dish }) => {
    const dishTicks = tickedByDish[item.name] || [];
    return (
      <View style={styles.tickOffDishGroup}>
        <Text style={styles.tickOffDishTitle}>{item.name}</Text>
        {item.ingredients.map((ingredient, index) => (
          <View key={index} style={styles.tickOffRow}>
            <CheckBox
              checked={dishTicks.includes(ingredient.name)}
              onPress={() => toggleTickForDish(item.name, ingredient.name)}
            />
            <Text style={styles.tickOffText}>
              {ingredient.name}: {ingredient.weight * item.quantity} {ingredient.unit}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // Open the tick-off bottom-sheet based on mode
  const openTickOffSheet = (mode: 'all' | 'dish') => {
    setTickOffMode(mode);
    setSelectedTickOffDish(null);
    setTickedByDish({});
    setTickedIngredients([]);
    tickOffBottomSheetRef.current?.snapToIndex(0);
  };

  // Confirm tick-off action
  const handleConfirmTickOff = () => {
    if (tickOffMode === 'all') {
      console.log("Ticked Ingredients:", tickedIngredients);
      // Iterate through each dish and remove the ticked ingredients
      dishesStack.forEach((dish) => {
        const updatedIngredients = dish.ingredients.filter(
          (ingredient) => !tickedIngredients.includes(ingredient.name)
        );
        if (updatedIngredients.length === 0) {
          // Remove the dish if no ingredients remain
          removeDish(dish.name);
        } else {
          updateDish(dish.name, dish.quantity, updatedIngredients);
        }
      });

      // Reset the tickedIngredients state
      setTickedIngredients([]);
      setTickOffMode(null);
      setSelectedTickOffDish(null);

      Alert.alert("Ingredients Tick-Off", "Selected ingredients have been removed from all dishes.");
      tickOffBottomSheetRef.current?.close();
    } else if (tickOffMode === 'dish') {
      console.log("Ticked By Dish:", tickedByDish);
      // Iterate through each dish and remove the ticked ingredients
      Object.entries(tickedByDish).forEach(([dishName, ingredients]) => {
        if (ingredients.length > 0) {
          const dish = dishesStack.find(d => d.name === dishName);
          if (dish) {
            const updatedIngredients = dish.ingredients.filter(
              (ingredient) => !ingredients.includes(ingredient.name)
            );
            if (updatedIngredients.length === 0) {
              removeDish(dish.name);
            } else {
              updateDish(dish.name, dish.quantity, updatedIngredients);
            }
          }
        }
      });

      // Reset the tickedByDish state
      setTickedByDish({});
      setTickOffMode(null);
      setSelectedTickOffDish(null);

      Alert.alert("Ingredients Tick-Off", "Selected ingredients have been removed from the respective dishes.");
      tickOffBottomSheetRef.current?.close();
    }
  };
  // -------------------------------
  // End Tick-Off Bottom-Sheet
  // -------------------------------

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        {/* SUMMARY BUTTON */}
        <TouchableOpacity style={styles.summaryButton} onPress={handleSummaryToggle}>
          <Text style={styles.summaryButtonText}>Summary</Text>
        </TouchableOpacity>

        {summaryExpanded && (
          <>
            {/* Prep List Section */}
            <Text style={styles.sectionTitle}>Dishes to Prep</Text>
            <FlatList
              data={dishesStack}
              keyExtractor={(_, index) => String(index)}
              renderItem={renderDish}
              scrollEnabled={false}
            />

            {/* Aggregated Ingredients Section */}
            <Text style={styles.sectionTitle}>Total Ingredients Required</Text>
            <FlatList
              data={aggregatedIngredientsArray}
              keyExtractor={([name]) => name}
              renderItem={renderIngredient}
              scrollEnabled={false}
            />
          </>
        )}

        {/* -------------------------------
            Ingredient Tick-Off Section (Outside Summary Block)
           ------------------------------- */}
        <View style={styles.tickOffSection}>
          <Text style={styles.sectionTitle}>Ingredient Tick-Off</Text>
          <View style={styles.tickOffOptions}>
            <Pressable
              style={styles.tickOffOptionButton}
              onPress={() => openTickOffSheet('dish')}
            >
              <Text style={styles.tickOffOptionText}>Tick Off Ingredients from a Dish</Text>
            </Pressable>
            <Pressable
              style={styles.tickOffOptionButton}
              onPress={() => openTickOffSheet('all')}
            >
              <Text style={styles.tickOffOptionText}>Tick Off All Ingredients</Text>
            </Pressable>
          </View>
        </View>
        {/* -------------------------------
            End Ingredient Tick-Off Section
           ------------------------------- */}

        {/* -------------------------------
            Advanced Mode Section (New)
           ------------------------------- */}
        <View style={styles.advancedModeSection}>
          <Pressable
            style={styles.advancedModeButton}
            onPress={() => {
              // 1) Log the current dishes stack
              console.warn("Dishes stack before navigating:", JSON.stringify(dishesStack, null, 2));
    
              // 2) Then navigate to advanced mode
              router.push("/advanced-mode");
            }}
          >
            <Text style={styles.advancedModeButtonText}>Advanced View</Text>
          </Pressable>
        </View>
        {/* -------------------------------
            End Advanced Mode Section
           ------------------------------- */}
      </ScrollView>

      {/* -------------------------------
          CRUD Bottom-Sheet for Editing a Dish (prep bag)
         ------------------------------- */}
      <BottomSheet
        ref={crudBottomSheetRef}
        index={-1}
        snapPoints={['25%', '50%']}
        enablePanDownToClose={true}
        onChange={() => {}}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {editingDish && (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.sheetInnerContainer}>
                <Text style={styles.bottomSheetTitle}>Edit "{editingDish.name}"</Text>
                <TextInput
                  style={styles.bottomSheetInput}
                  keyboardType="numeric"
                  placeholder="Enter new quantity"
                  placeholderTextColor="#999"
                  value={sheetQuantity}
                  onChangeText={setSheetQuantity}
                />
                <View style={styles.sheetButtonContainer}>
                  <Pressable style={styles.sheetButton} onPress={handleSaveEdit}>
                    <Text style={styles.sheetButtonText}>Save Changes</Text>
                  </Pressable>
                  <Pressable style={[styles.sheetButton, styles.removeButton]} onPress={handleRemove}>
                    <Text style={styles.sheetButtonText}>Remove Dish</Text>
                  </Pressable>
                  <Pressable style={[styles.sheetButton, styles.cancelButton]} onPress={handleCancelEdit}>
                    <Text style={styles.sheetButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          )}
        </BottomSheetView>
      </BottomSheet>
      {/* -------------------------------
          End CRUD Bottom-Sheet
         ------------------------------- */}

      {/* -------------------------------
          Bottom-Sheet for Ingredient Tick-Off (Grouped by Dish or All)
         ------------------------------- */}
      <BottomSheet
        ref={tickOffBottomSheetRef}
        index={-1}
        snapPoints={tickOffMode === 'all' ? ['60%', '90%'] : ['50%', '80%']} // Increased snap points for better visibility
        enablePanDownToClose={true}
        onChange={() => {}}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {tickOffMode === 'all' && (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.sheetInnerContainer}>
                <Text style={styles.bottomSheetTitle}>Tick Off All Ingredients</Text>
                {/* Scrollable Container for FlatList */}
                <View style={styles.scrollableContainer}>
                  <FlatList
                    data={uniqueIngredients}
                    keyExtractor={(item) => item.name}
                    renderItem={renderTickOffIngredient}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    nestedScrollEnabled={true} // Enables nested scrolling
                  />
                </View>
                <Pressable
                  style={[
                    styles.tickOffConfirmButton,
                    tickedIngredients.length === 0 && styles.disabledButton,
                  ]}
                  onPress={handleConfirmTickOff}
                  disabled={tickedIngredients.length === 0}
                >
                  <Text style={styles.tickOffConfirmButtonText}>Confirm Tick-Off</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          )}

          {tickOffMode === 'dish' && (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.sheetInnerContainer}>
                <Text style={styles.bottomSheetTitle}>Tick Off Ingredients from a Dish</Text>
                {/* Dropdown or FlatList to select a dish */}
                <FlatList
                  data={dishesStack}
                  keyExtractor={(item) => item.name}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.selectDishItem,
                        selectedTickOffDish === item.name && styles.selectedDishItem,
                      ]}
                      onPress={() => setSelectedTickOffDish(item.name)}
                    >
                      <Text style={styles.selectDishText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  style={{ maxHeight: 150 }} // Limit height to prevent overflow
                  nestedScrollEnabled={true}
                />
                {selectedTickOffDish && (
                  <View style={styles.selectedDishIngredients}>
                    <Text style={styles.selectedDishTitle}>
                      Ingredients for "{selectedTickOffDish}"
                    </Text>
                    <FlatList
                      data={dishesStack.find((dish) => dish.name === selectedTickOffDish)?.ingredients || []}
                      keyExtractor={(item) => item.name}
                      renderItem={({ item }) => (
                        <View style={styles.tickOffRow}>
                          <CheckBox
                            checked={
                              tickedByDish[selectedTickOffDish]?.includes(item.name) || false
                            }
                            onPress={() =>
                              toggleTickForDish(selectedTickOffDish, item.name)
                            }
                          />
                          <Text style={styles.tickOffText}>
                            {item.name}: {item.weight * dishesStack.find(d => d.name === selectedTickOffDish)!.quantity} {item.unit}
                          </Text>
                        </View>
                      )}
                      // Remove scroll from inner FlatList; outer FlatList handles it
                      scrollEnabled={false}
                    />
                  </View>
                )}
                <Pressable
                  style={[
                    styles.tickOffConfirmButton,
                    !selectedTickOffDish && styles.disabledButton,
                  ]}
                  onPress={handleConfirmTickOff}
                  disabled={!selectedTickOffDish}
                >
                  <Text style={styles.tickOffConfirmButtonText}>Confirm Tick-Off</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          )}
        </BottomSheetView>
      </BottomSheet>
      {/* -------------------------------
          End Ingredient Tick-Off Bottom-Sheet
         ------------------------------- */}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121212',
    flex: 1,
  },
  summaryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 5,
    alignSelf: 'center',
    marginTop: 20,
  },
  summaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 10,
    marginTop: 20,
    marginBottom: 8,
  },
  dishItem: {
    backgroundColor: '#1e1e1e',
    borderRadius: 5,
    padding: 10,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  dishName: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 16,
  },
  ingredientItem: {
    backgroundColor: '#1e1e1e',
    borderRadius: 5,
    padding: 10,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  ingredientText: {
    color: '#fff',
    fontSize: 16,
  },
  // Tick-Off section styling
  tickOffSection: {
    marginTop: 30,
    paddingHorizontal: 10,
  },
  tickOffOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  tickOffOptionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginHorizontal: 10,
    flex: 1,
  },
  tickOffOptionText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tickOffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  tickOffText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  tickOffButtonContainer: {
    alignItems: 'center',
    marginTop: 15,
  },
  tickOffButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 15,
  },
  tickOffButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#888',
  },
  tickOffConfirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 15,
  },
  tickOffConfirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Advanced Mode Section Styles
  advancedModeSection: {
    marginTop: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  advancedModeButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 5,
  },
  advancedModeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Common Styles
  noPrepBagsText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  // Bottom-Sheet / CRUD styles
  bottomSheetBackground: {
    backgroundColor: '#1e1e1e',
    borderRadius: 15,
  },
  bottomSheetHandle: {
    backgroundColor: '#666',
  },
  bottomSheetContent: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
  sheetInnerContainer: {
    width: '100%',
    flex: 1, // Allow the container to take up full space
    justifyContent: 'space-between', // Distribute space between FlatList and button
    alignItems: 'center',
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  bottomSheetInput: {
    width: '100%',
    backgroundColor: '#282828',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 12,
  },
  sheetButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  sheetButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  removeButton: {
    backgroundColor: '#dc3545',
  },
  cancelButton: {
    backgroundColor: '#888',
  },
  sheetButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Checkbox styles for tick-off section
  checkboxContainer: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 16,
  },
  // Tick-Off Dish Group styles (group ingredients by dish)
  tickOffDishGroup: {
    backgroundColor: '#1e1e1e',
    borderRadius: 5,
    padding: 10,
    marginVertical: 10,
    marginHorizontal: 10,
  },
  tickOffDishTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  // Styles for selecting a dish in 'dish' mode
  selectDishItem: {
    backgroundColor: '#1e1e1e',
    borderRadius: 5,
    padding: 10,
    marginVertical: 5,
    marginHorizontal: 10,
  },
  selectedDishItem: {
    backgroundColor: '#4CAF50',
  },
  selectDishText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  selectedDishIngredients: {
    marginTop: 10,
    width: '100%',
  },
  selectedDishTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  // New style for the scrollable container within the bottom sheet
  scrollableContainer: {
    flex: 1, // Occupy all available vertical space
    width: '100%',
  },
});
