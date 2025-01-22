import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TextInput,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Snackbar } from 'react-native-paper';
import fuzzysort from 'fuzzysort';
import { router } from 'expo-router';

// Bottom Sheet
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

// SwipeListView
import { SwipeListView } from 'react-native-swipe-list-view';

// Context / data
import { useRecipeContext } from '@/context/RecipeContext';
import { Recipe } from '@/types/recipe';
import apiEndpoints from '@/constants/apiConfig';
import { useDishesContext } from '@/context/DishesContext';

const ROW_HEIGHT = 100;

export default function RecipePreview() {
  const { recipes, fetchRecipes, setRecipes } = useRecipeContext();
  const [refreshing, setRefreshing] = useState(false);

  // For deleting/undoing a recipe
  const [deletedRecipe, setDeletedRecipe] = useState<Recipe | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  // For searching & sorting
  const [filter, setFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // For adding a dish
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [prepAmount, setPrepAmount] = useState('');
  const [addedDishVisible, setAddedDishVisible] = useState(false);
  const [addedDishName, setAddedDishName] = useState('');
  const [addedDishQuantity, setAddedDishQuantity] = useState(0);

  // Bottom sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  // from DishesContext
  const { addDish, undoDish } = useDishesContext();

  useEffect(() => {
    fetchRecipes();
  }, []);

  // Filter & sort
  const filteredRecipes = filter
    ? fuzzysort
        .go(filter, recipes, { keys: ['name'], threshold: -10000 })
        .map((res) => res.obj)
        .sort((a, b) => {
          const comparison = a.name.localeCompare(b.name);
          return sortOrder === 'asc' ? comparison : -comparison;
        })
    : [...recipes].sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      });

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
  };

  // Delete logic
  const handleDelete = async (id: string) => {
    try {
      const resp = await fetch(`${apiEndpoints.recipes}/${id}`, {
        method: 'DELETE',
      });
      if (!resp.ok) {
        throw new Error('Failed to delete recipe.');
      }
    } catch (err) {
      console.error('Error deleting recipe:', err);
    }
  };

  const handleDeleteWithReset = async (item: Recipe) => {
    await handleDelete(item._id);
    setRecipes((prev) => prev.filter((r) => r._id !== item._id));
    setDeletedRecipe(item);
    setSnackbarVisible(true);
  };

  const handleUndoDelete = async () => {
    if (!deletedRecipe) return;
    try {
      const resp = await fetch(`${apiEndpoints.recipes}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deletedRecipe),
      });
      if (!resp.ok) {
        throw new Error('Failed to restore recipe.');
      }
      setRecipes((prev) => [deletedRecipe, ...prev]);
      setDeletedRecipe(null);
    } catch (err) {
      console.error('Error restoring recipe:', err);
    }
    setSnackbarVisible(false);
  };

  // Add dish logic
  const handleAddDish = () => {
    if (!selectedRecipe) return;
    const q = parseInt(prepAmount, 10) || 0;
    const newDish = {
      name: selectedRecipe.name,
      ingredients: selectedRecipe.ingredients || [],
      quantity: q,
    };
    addDish(newDish, q);

    setAddedDishName(selectedRecipe.name);
    setAddedDishQuantity(q);
    setAddedDishVisible(true);

    bottomSheetRef.current?.close();
    setSelectedRecipe(null);
    setPrepAmount('');
  };

  const handleUndoAddDish = () => {
    undoDish();
    setAddedDishVisible(false);
  };

  // Navigation
  const handleRecipeClick = (recipe: Recipe) => {
    router.push({
      pathname: '../recipe-detail',
      params: { recipe: JSON.stringify(recipe) },
    });
  };

  // Open bottom sheet
  const openBottomSheetForAdd = (item: Recipe) => {
    setSelectedRecipe(item);
    setPrepAmount('');
    bottomSheetRef.current?.snapToIndex(0);
  };

  // Visible row
  const renderVisibleItem = ({ item }: { item: Recipe }) => (
    <View style={styles.rowWrapper}>
      <TouchableOpacity
        style={styles.visibleRow}
        onPress={() => handleRecipeClick(item)}
      >
        <Text style={styles.recipeName}>{item.name}</Text>
        <Text style={styles.portion}>Portion: {item.originalPortion}</Text>
      </TouchableOpacity>
    </View>
  );

  // Hidden row
  const renderHiddenItem = ({ item }: { item: Recipe }) => (
    <View style={styles.rowWrapper}>
      <View style={[styles.hiddenAction, styles.hiddenLeft]}>
        <Text style={styles.hiddenText}>Add</Text>
      </View>
      <View style={[styles.hiddenAction, styles.hiddenRight]}>
        <Text style={styles.hiddenText}>Delete</Text>
      </View>
    </View>
  );

  // onRowOpen => decide if left or right
  const onRowOpen = (rowKey: string, rowMap: any, toValue: number) => {
    const foundItem = filteredRecipes.find((r) => r._id === rowKey);
    if (!foundItem) return;

    if (toValue < 0) {
      // negative => swiped right => delete
      handleDeleteWithReset(foundItem);
    } else {
      // positive => swiped left => add
      openBottomSheetForAdd(foundItem);
    }
    // close row so it doesn't stay open
    rowMap[rowKey]?.closeRow();
  };

  // friction/tension
  const friction = 2;
  const tension = 40;

  // (Optional) track sheet changes
  const handleSheetChange = (index: number) => {
    // If user pulls it fully down beyond snap points, it closes automatically
    // You could detect index === -1 here if needed
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Filter & Sort Controls */}
      <View style={styles.filterSortContainer}>
        <TextInput
          style={styles.filterInput}
          placeholder="Search recipes..."
          placeholderTextColor="#777"
          onChangeText={setFilter}
        />
        <Pressable
          style={styles.sortButton}
          onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          <Text style={styles.sortButtonText}>
            Sort: {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </Text>
        </Pressable>
      </View>

      {/* SWIPE LIST VIEW */}
      <SwipeListView
        data={filteredRecipes}
        keyExtractor={(item) => item._id}
        renderItem={renderVisibleItem}
        renderHiddenItem={renderHiddenItem}
        leftOpenValue={75}
        rightOpenValue={-75}
        friction={friction}
        tension={tension}
        onRowOpen={onRowOpen}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recipes match your search.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {/* Snackbar for Delete */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        action={{
          label: 'Undo',
          onPress: handleUndoDelete,
        }}
      >
        Recipe deleted.
      </Snackbar>

      {/* Snackbar for Add */}
      <Snackbar
        visible={addedDishVisible}
        onDismiss={() => setAddedDishVisible(false)}
        action={{
          label: 'Undo',
          onPress: handleUndoAddDish,
        }}
      >
        {`Added ${addedDishName} (x${addedDishQuantity})`}
      </Snackbar>

      {/* BOTTOM SHEET with Pan-Down-Close enabled + dark styling */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['25%', '50%']}
        enablePanDownToClose={true} // close when user pulls down
        onChange={handleSheetChange}
        backgroundStyle={{ 
          // match dark theme
          backgroundColor: '#1e1e1e', 
          borderRadius: 15 
        }}
        handleIndicatorStyle={{
          backgroundColor: '#666',
        }}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {selectedRecipe ? (
            <>
              <Text style={styles.bottomSheetTitle}>
                Add "{selectedRecipe.name}" to Prep
              </Text>
              <TextInput
                style={styles.bottomSheetInput}
                placeholder="Enter amount to prep..."
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={prepAmount}
                onChangeText={setPrepAmount}
              />
              <Pressable style={styles.addButton} onPress={handleAddDish}>
                <Text style={styles.addButtonText}>Add Dish</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.bottomSheetPlaceholder}>
              Swipe from left on a recipe to add
            </Text>
          )}
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 10,
  },
  filterSortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#1e1e1e',
    color: '#ffffff',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
  },
  sortButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  sortButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  rowWrapper: {
    height: ROW_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#1e1e1e',
  },
  visibleRow: {
    flex: 1,
    justifyContent: 'center',
    padding: 10,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  portion: {
    fontSize: 14,
    color: '#b0b0b0',
    marginTop: 5,
  },
  hiddenAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenLeft: {
    backgroundColor: '#28a745',
    left: 2,
    top: 2,
    width: 150,
  },
  hiddenRight: {
    backgroundColor: '#dc3545',
    right: 2,
    top: 2,
    width: 150,
  },
  hiddenText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    marginTop: 50,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  bottomSheetContent: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#ffffff',
  },
  bottomSheetInput: {
    width: '100%',
    backgroundColor: '#282828',
    color: '#ffffff',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 12,
  },
  bottomSheetPlaceholder: {
    color: '#888',
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
