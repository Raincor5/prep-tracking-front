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
  Dimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useDishesContext } from '@/context/DishesContext';
import { Dish } from '@/types/dish';

// --- Helper Functions ---
// Compute the Levenshtein distance between two strings.
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
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[lenA][lenB];
}

// Convert Levenshtein distance to a similarity score (0 to 1).
function similarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  const dist = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);
  return 1 - dist / maxLen;
}

// Find a key in the accumulator similar to the given ingredient name.
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

// A simple checkbox component.
const CheckBox = ({
  checked,
  onPress,
  disabled,
}: {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} style={styles.checkboxContainer}>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Text style={styles.checkboxMark}>✔</Text>}
    </View>
  </TouchableOpacity>
);

// --- Scaling Utilities ---
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const guidelineBaseWidth = 350;
const guidelineBaseHeight = 680;
const scale = (size: number) => (SCREEN_WIDTH / guidelineBaseWidth) * size;
const verticalScale = (size: number) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

// --- Aggregation Helpers ---
// Compute aggregated remaining ingredients from incomplete prep bags.
const aggregatedIngredientsRemaining = (dishesStack: Dish[]) => {
  return dishesStack.reduce((acc, dish) => {
    const remainingCount = dish.prepBags.filter(bag => !bag.isComplete).length;
    dish.ingredients.forEach((ingredient) => {
      const weightNeeded = ingredient.weight * remainingCount;
      const similarKey = findSimilarIngredientKey(acc, ingredient.name, 0.8);
      if (similarKey) {
        acc[similarKey].totalWeight += weightNeeded;
      } else {
        acc[ingredient.name] = { totalWeight: weightNeeded, unit: ingredient.unit || '' };
      }
    });
    return acc;
  }, {} as Record<string, { totalWeight: number; unit: string }>);
};

// Helper: Determine if an ingredient is exhausted (i.e. added in every required prep bag).
const isIngredientExhausted = (ingredient: string, dishesStack: Dish[]): boolean => {
  let required = 0;
  let confirmed = 0;
  dishesStack.forEach((dish) => {
    if (dish.ingredients.some((ing: any) => ing.name === ingredient)) {
      required += dish.prepBags.length;
      dish.prepBags.forEach((bag) => {
        if (bag && bag.addedIngredients.some((ai) => ai.name === ingredient)) {
          confirmed++;
        }
      });
    }
  });
  return required > 0 && confirmed >= required;
};

// For dish-mode tick-off: Check if an ingredient is fully added in a specific dish.
const isIngredientFullyAddedInDish = (ingredient: string, dish: Dish): boolean => {
  const totalBags = dish.prepBags.length;
  const confirmed = dish.prepBags.filter(bag =>
    bag.addedIngredients.some((ai) => ai.name === ingredient)
  ).length;
  return confirmed >= totalBags;
};

// --- Main Component ---
export default function TabTwoScreen() {
  // No summary toggle state now – summary is always visible.
  const { dishesStack, removeDish, updateDish, updatePrepBag } = useDishesContext();
  const router = useRouter();

  // CRUD bottom-sheet state.
  const [editingDish, setEditingDish] = useState<{ name: string; quantity: number } | null>(null);
  const [sheetQuantity, setSheetQuantity] = useState('');

  // Tick-off state.
  const [tickedIngredients, setTickedIngredients] = useState<string[]>([]);
  const [tickedByDish, setTickedByDish] = useState<Record<string, string[]>>({});
  const [tickOffMode, setTickOffMode] = useState<'all' | 'dish' | null>(null);
  const [selectedTickOffDish, setSelectedTickOffDish] = useState<string | null>(null);

  // Bottom-sheet refs.
  const crudBottomSheetRef = useRef<BottomSheet>(null);
  const tickOffBottomSheetRef = useRef<BottomSheet>(null);

  // Aggregated remaining ingredients.
  const aggregatedIngredientsRemainingObject = useMemo(
    () => aggregatedIngredientsRemaining(dishesStack),
    [dishesStack]
  );
  const aggregatedIngredientsRemainingArray = useMemo(
    () => Object.entries(aggregatedIngredientsRemainingObject),
    [aggregatedIngredientsRemainingObject]
  );

  // Unique ingredients (for tick-off "all" mode).
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

  // Render each dish in the prep list.
  const renderDish = ({ item }: { item: Dish }) => (
    <TouchableOpacity style={styles.dishItem} onPress={() => openCrudSheet(item)}>
      <Text style={styles.dishName}>
        {item.name} (x{item.prepBags.length})
      </Text>
    </TouchableOpacity>
  );

  // Render each ingredient (aggregated remaining) in the summary.
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
  // CRUD Bottom-Sheet for Editing a Dish.
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
  // Tick-Off Functionality.
  // For 'dish' mode:
  const toggleTickForDish = (dishName: string, ingredientName: string) => {
    setTickedByDish(prev => {
      const dishTicks = prev[dishName] || [];
      if (dishTicks.includes(ingredientName)) {
        return { ...prev, [dishName]: dishTicks.filter(n => n !== ingredientName) };
      } else {
        return { ...prev, [dishName]: [...dishTicks, ingredientName] };
      }
    });
  };

  // For 'all' mode:
  const toggleTickOffIngredient = (ingredientName: string) => {
    setTickedIngredients(prev => {
      if (prev.includes(ingredientName)) {
        return prev.filter(name => name !== ingredientName);
      } else {
        return [...prev, ingredientName];
      }
    });
  };

  // Render tick-off for "all" mode.
  const renderTickOffIngredient = ({ item }: { item: { name: string; unit: string } }) => {
    const isExhausted = isIngredientExhausted(item.name, dishesStack);
    return (
      <View style={styles.tickOffRow}>
        <CheckBox
          checked={tickedIngredients.includes(item.name)}
          onPress={() => { if (!isExhausted) toggleTickOffIngredient(item.name); }}
          disabled={isExhausted}
        />
        <Text style={[styles.tickOffText, isExhausted && styles.strikethroughText]}>
          {item.name}
        </Text>
      </View>
    );
  };

  // Render tick-off for "dish" mode.
  const renderTickOffDishGroup = ({ item }: { item: Dish }) => {
    const dishTicks = tickedByDish[item.name] || [];
    return (
      <View style={styles.tickOffDishGroup}>
        <Text style={styles.tickOffDishTitle}>{item.name}</Text>
        {item.ingredients.map((ingredient, index) => {
          const totalBags = item.prepBags.length;
          const confirmedCount = item.prepBags.filter(bag =>
            bag.addedIngredients.some(ai => ai.name === ingredient.name)
          ).length;
          const isExhaustedForDish = confirmedCount >= totalBags;
          return (
            <View key={index} style={styles.tickOffRow}>
              <CheckBox
                checked={dishTicks.includes(ingredient.name)}
                onPress={() => { if (!isExhaustedForDish) toggleTickForDish(item.name, ingredient.name); }}
                disabled={isExhaustedForDish}
              />
              <Text style={[styles.tickOffText, isExhaustedForDish && styles.strikethroughText]}>
                {ingredient.name}: {ingredient.weight * item.quantity} {ingredient.unit}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const openTickOffSheet = (mode: 'all' | 'dish') => {
    setTickOffMode(mode);
    setSelectedTickOffDish(null);
    setTickedByDish({});
    setTickedIngredients([]);
    // Open tick-off bottom sheet maximized (snap to index 0 corresponds to 95% height)
    tickOffBottomSheetRef.current?.snapToIndex(0);
  };

  // Confirm tick-off by adding ticked ingredients to the prep bags.
  const handleConfirmTickOff = () => {
    if (tickOffMode === 'all') {
      dishesStack.forEach((dish) => {
        dish.prepBags.forEach((bag) => {
          let updatedIngredients = [...bag.addedIngredients];
          tickedIngredients.forEach(ingredientName => {
            if (
              dish.ingredients.some(ing => ing.name === ingredientName) &&
              !updatedIngredients.some(ai => ai.name === ingredientName)
            ) {
              const ingredientObj = dish.ingredients.find(i => i.name === ingredientName);
              if (ingredientObj) {
                updatedIngredients.push(ingredientObj);
              }
            }
          });
          if (updatedIngredients.length !== bag.addedIngredients.length) {
            updatePrepBag(bag.id, updatedIngredients);
          }
        });
      });
      setTickedIngredients([]);
      setTickOffMode(null);
      setSelectedTickOffDish(null);
      Alert.alert("Ingredients Tick-Off", "Ticked ingredients have been added to all prep bags.");
      tickOffBottomSheetRef.current?.close();
    } else if (tickOffMode === 'dish') {
      if (selectedTickOffDish) {
        const dish = dishesStack.find(d => d.name === selectedTickOffDish);
        if (dish) {
          dish.prepBags.forEach(bag => {
            let updatedIngredients = [...bag.addedIngredients];
            const dishTicks = tickedByDish[selectedTickOffDish] || [];
            dishTicks.forEach(ingredientName => {
              if (
                dish.ingredients.some(ing => ing.name === ingredientName) &&
                !updatedIngredients.some(ai => ai.name === ingredientName)
              ) {
                const ingredientObj = dish.ingredients.find(i => i.name === ingredientName);
                if (ingredientObj) {
                  updatedIngredients.push(ingredientObj);
                }
              }
            });
            if (updatedIngredients.length !== bag.addedIngredients.length) {
              updatePrepBag(bag.id, updatedIngredients);
            }
          });
        }
        setTickedByDish({});
        setTickOffMode(null);
        setSelectedTickOffDish(null);
        Alert.alert("Ingredients Tick-Off", "Ticked ingredients have been added to the selected dish's prep bags.");
        tickOffBottomSheetRef.current?.close();
      }
    }
  };
  // -------------------------------
  // End Tick-Off Functionality
  // -------------------------------

  // Advanced Mode: navigate to advanced mode.
  const openAdvancedMode = () => {
    console.warn("Dishes stack before navigating:", JSON.stringify(dishesStack, null, 2));
    router.push("/advanced-mode");
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        {/* Always visible Summary Block */}
        <Text style={styles.sectionTitle}>Dishes to Prep</Text>
        <FlatList
          data={dishesStack}
          keyExtractor={(_, index) => String(index)}
          renderItem={renderDish}
          scrollEnabled={false}
        />
        <Text style={styles.sectionTitle}>Ingredients Remaining to Add</Text>
        <FlatList
          data={aggregatedIngredientsRemainingArray}
          keyExtractor={([name]) => name}
          renderItem={renderIngredient}
          scrollEnabled={false}
        />

        {/* Ingredient Tick-Off Section */}
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

        {/* Advanced Mode Button placed below tick-off section */}
        <View style={styles.advancedModeSection}>
          <Pressable style={styles.advancedModeButton} onPress={openAdvancedMode}>
            <Text style={styles.advancedModeButtonText}>Advanced View</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* CRUD Bottom-Sheet for Editing a Dish */}
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

      {/* Bottom-Sheet for Ingredient Tick-Off (Maximized) */}
      <BottomSheet
        ref={tickOffBottomSheetRef}
        index={-1}
        snapPoints={['95%', '50%']}
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
                <View style={styles.scrollableContainer}>
                  <FlatList
                    data={uniqueIngredients}
                    keyExtractor={(item) => item.name}
                    renderItem={renderTickOffIngredient}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    nestedScrollEnabled={true}
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
                  style={{ maxHeight: 150 }}
                  nestedScrollEnabled={true}
                />
                {selectedTickOffDish && (
                  <View style={styles.selectedDishIngredients}>
                    <Text style={styles.selectedDishTitle}>
                      Ingredients for "{selectedTickOffDish}"
                    </Text>
                    <FlatList
                      data={dishesStack.find(d => d.name === selectedTickOffDish)?.ingredients || []}
                      keyExtractor={(item) => item.name}
                      renderItem={({ item }) => {
                        const dish = dishesStack.find(d => d.name === selectedTickOffDish)!;
                        const totalBags = dish.prepBags.length;
                        const confirmedCount = dish.prepBags.filter(bag =>
                          bag.addedIngredients.some(ai => ai.name === item.name)
                        ).length;
                        const isExhaustedForDish = confirmedCount >= totalBags;
                        return (
                          <View style={styles.tickOffRow}>
                            <CheckBox
                              checked={tickedByDish[selectedTickOffDish]?.includes(item.name) || false}
                              onPress={() => { if (!isExhaustedForDish) toggleTickForDish(selectedTickOffDish, item.name); }}
                              disabled={isExhaustedForDish}
                            />
                            <Text style={[styles.tickOffText, isExhaustedForDish && styles.strikethroughText]}>
                              {item.name}: {item.weight * dish.quantity} {item.unit}
                            </Text>
                          </View>
                        );
                      }}
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
      {/* End Ingredient Tick-Off Bottom-Sheet */}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121212',
    flex: 1,
  },
  summaryButton: {
    // Removed summary button styling since it's no longer rendered.
  },
  summaryButtonText: {
    // Removed summary button text styling.
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
    justifyContent: 'center',
    alignItems: 'center',
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
  strikethroughText: {
    textDecorationLine: 'line-through',
    color: '#888',
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
  disabledButton: {
    backgroundColor: '#888',
  },
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
    flex: 1,
    justifyContent: 'space-between',
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
  scrollableContainer: {
    flex: 1,
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    maxHeight: "100%",
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 0,
    padding: scale(16),
  },
  modalHeaderText: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    marginBottom: verticalScale(8),
    textAlign: "center",
    color: "#fff",
  },
  modalScroll: {
    marginBottom: verticalScale(8),
  },
  ingredientRow: {
    paddingVertical: verticalScale(4),
    borderBottomWidth: 1,
    borderBottomColor: "#555",
  },
  ingredientName: {
    fontSize: moderateScale(16),
    color: "#fff",
  },
  ingredientAdded: {
    color: "green",
  },
  closeButton: {
    alignSelf: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(16),
    borderRadius: scale(4),
  },
  closeButtonText: {
    color: "#fff",
    fontSize: moderateScale(16),
    fontWeight: "bold",
  },
  // Drag Handle styles.
  dragHandle: {
    position: "absolute",
    top: scale(4),
    right: scale(4),
    padding: scale(4),
    backgroundColor: "#333",
    borderRadius: scale(4),
  },
  dragHandleText: {
    color: "#fff",
    fontSize: moderateScale(14),
  },
});

export { TabTwoScreen };
