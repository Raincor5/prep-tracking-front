import React, { useState, useRef } from 'react';
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
import { useDishesContext, Dish } from '@/context/DishesContext';

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
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
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

export default function TabTwoScreen() {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const { dishesStack, removeDish, updateDish } = useDishesContext();

  // Local state for bottom-sheet CRUD operations:
  // editingDish: the dish selected to modify.
  const [editingDish, setEditingDish] = useState<{ name: string; quantity: number } | null>(null);
  // sheetQuantity: the new quantity entered.
  const [sheetQuantity, setSheetQuantity] = useState('');

  // Bottom Sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  const handleSummaryToggle = () => {
    setSummaryExpanded((prev) => !prev);
  };

  /**
   * Build an aggregated list of all ingredients across dishes.
   */
  const aggregatedIngredients = dishesStack.reduce(
    (acc, dish) => {
      dish.ingredients.forEach((ingredient) => {
        const totalWeight = ingredient.weight * dish.quantity;
        const similarKey = findSimilarIngredientKey(acc, ingredient.name, 0.8);
        if (similarKey) {
          acc[similarKey].totalWeight += totalWeight;
        } else {
          if (!acc[ingredient.name]) {
            acc[ingredient.name] = { totalWeight: 0, unit: ingredient.unit || '' };
          }
          acc[ingredient.name].totalWeight += totalWeight;
        }
      });
      return acc;
    },
    {} as Record<string, { totalWeight: number; unit: string }>
  );
  const aggregatedIngredientsArray = Object.entries(aggregatedIngredients);

  // Render a single dish in the prep list.
  const renderDish = ({ item }: { item: Dish }) => (
    <TouchableOpacity style={styles.dishItem} onPress={() => openCrudSheet(item)}>
      <Text style={styles.dishName}>
        {item.name} (x{item.quantity})
      </Text>
    </TouchableOpacity>
  );

  // Render a single aggregated ingredient.
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

  // Open bottom-sheet for CRUD editing
  const openCrudSheet = (dish: Dish) => {
    setEditingDish({ name: dish.name, quantity: dish.quantity });
    setSheetQuantity(String(dish.quantity));
    bottomSheetRef.current?.snapToIndex(0);
  };

  // Save updated quantity from bottom-sheet
  const handleSaveEdit = () => {
    const qty = parseInt(sheetQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a valid positive number.");
      return;
    }
    if (editingDish) {
      updateDish(editingDish.name, qty);
      setEditingDish(null);
      setSheetQuantity('');
      Keyboard.dismiss();
      bottomSheetRef.current?.close();
    }
  };

  // Remove dish from prep list.
  const handleRemove = () => {
    if (editingDish) {
      removeDish(editingDish.name);
      setEditingDish(null);
      setSheetQuantity('');
      Keyboard.dismiss();
      bottomSheetRef.current?.close();
    }
  };

  // Cancel bottom-sheet editing.
  const handleCancelEdit = () => {
    setEditingDish(null);
    setSheetQuantity('');
    Keyboard.dismiss();
    bottomSheetRef.current?.close();
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* SUMMARY BUTTON */}
        <TouchableOpacity style={styles.summaryButton} onPress={handleSummaryToggle}>
          <Text style={styles.summaryButtonText}>Summary</Text>
        </TouchableOpacity>

        {summaryExpanded && (
          <>
            {/* Prep List */}
            <Text style={styles.sectionTitle}>Dishes to Prep</Text>
            <FlatList
              data={dishesStack}
              keyExtractor={(_, index) => String(index)}
              renderItem={renderDish}
              scrollEnabled={false}
            />

            {/* Aggregated Ingredients */}
            <Text style={styles.sectionTitle}>Total Ingredients Required</Text>
            <FlatList
              data={aggregatedIngredientsArray}
              keyExtractor={([name]) => name}
              renderItem={renderIngredient}
              scrollEnabled={false}
            />
          </>
        )}
      </ScrollView>

      {/* Bottom-Sheet for CRUD Operations */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['25%', '50%']}
        enablePanDownToClose={true}
        onChange={() => {}}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {editingDish && (
            // Wrap content in TouchableWithoutFeedback to dismiss keyboard on tap.
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
                  <Pressable
                    style={styles.sheetButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleSaveEdit();
                    }}
                  >
                    <Text style={styles.sheetButtonText}>Save Changes</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.sheetButton, styles.removeButton]}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleRemove();
                    }}
                  >
                    <Text style={styles.sheetButtonText}>Remove Dish</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.sheetButton, styles.cancelButton]}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleCancelEdit();
                    }}
                  >
                    <Text style={styles.sheetButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          )}
        </BottomSheetView>
      </BottomSheet>
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
});
