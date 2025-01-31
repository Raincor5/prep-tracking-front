import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useDishesContext } from "@/context/DishesContext";
import DraggableDish from "@/app/advanced-mode/DraggableDish";

export default function AdvancedMode() {
  const { dishesStack, addDish, reorderDishes } = useDishesContext();

  /**
   * Add a test dish for initial rendering.
   * We pass (dishData, quantity) as 2 arguments,
   * and 'quantity' is used inside DishesContext to build the dish.
   */
  useEffect(() => {
    if (dishesStack.length === 0) {
      addDish(
        {
          name: "Dish-1",
          ingredients: [{ name: "Flour", weight: 1, unit: "kg" }],
        },
        5 // quantity
      );
    }
  }, [dishesStack.length, addDish]);

  /**
   * Renders each draggable dish item in the list.
   * Note: If your DraggableFlatList doesn't give you 'index',
   * just omit it from destructuring.
   */
  const renderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<typeof dishesStack[0]>) => (
    <TouchableOpacity
      onLongPress={drag}
      disabled={isActive}
      style={[styles.dishItem, { opacity: isActive ? 0.8 : 1 }]}
    >
      {/* If DraggableDish doesn't need an index, omit it */}
      <DraggableDish
        label={item.name}
        matrix={item.matrix}
        colour={item.colour}
      />
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* DraggableFlatList to reorder entire dishes */}
            <DraggableFlatList
              data={dishesStack}
              keyExtractor={(dish) => dish.id}
              renderItem={renderItem}
              onDragEnd={({ data }) => reorderDishes(data)}
              horizontal
              contentContainerStyle={styles.listContent}
            />

            {/* Add a new Dish with random quantity */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() =>
                addDish(
                  {
                    name: `Dish-${dishesStack.length + 1}`,
                    ingredients: [],
                  },
                  Math.floor(Math.random() * 8) + 1 // random quantity
                )
              }
            >
              <Text style={styles.addButtonText}>Add Dish</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  container: {
    flex: 1,
    padding: 10,
  },
  listContent: {
    paddingVertical: 10,
  },
  dishItem: {
    marginRight: 10, // space between dishes in the horizontal list
  },
  addButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    alignSelf: "center",
    marginTop: 10,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
});
