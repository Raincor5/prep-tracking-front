// app/advanced-mode/DraggableDish.tsx
// A draggable dish component for the advanced mode of the app.
// Purpose: This component displays a draggable dish with a matrix of prep bags. It allows users to interact with the dish and its prep bags.

import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { PrepBag } from "@/types/prepBags";
import { useIngredientsContext } from "@/context/IngredientsContext";

type DraggableDishProps = {
  label: string;
  matrix: (PrepBag | null)[][];
  colour?: string;
  editable?: boolean;
  onBagPress?: (bagId: string) => void;
  // New prop: list of selected ingredients to check for exhaustion per prep bag.
  selectedIngredients?: string[];
};

const COLOR_POOL = ["#f94144", "#f3722c", "#f9c74f", "#90be6d", "#43aa8b", "#577590"];
let availableColors = [...COLOR_POOL];
const dishColorMap: Record<string, string> = {};

function getRandomColor(dishName: string) {
  if (dishColorMap[dishName]) return dishColorMap[dishName];
  if (availableColors.length === 0) {
    availableColors = [...COLOR_POOL];
  }
  const index = Math.floor(Math.random() * availableColors.length);
  const chosen = availableColors[index];
  availableColors.splice(index, 1);
  dishColorMap[dishName] = chosen;
  return chosen;
}

const DraggableDish: React.FC<DraggableDishProps> = memo(({ matrix, label, colour, editable, onBagPress, selectedIngredients = [] }) => {
  const { getEffectiveCount } = useIngredientsContext();
  const cellSize = 50;
  const cellMargin = 2;
  const numRows = matrix.length;
  const numCols = numRows > 0 ? matrix[0].length : 0;
  const calculatedWidth = numCols * (cellSize + cellMargin * 2) + 20;
  const calculatedHeight = numRows * (cellSize + cellMargin * 2) + 40;
  const minWidth = 200;
  const minHeight = 150;
  const dynamicWidth = Math.max(calculatedWidth, minWidth);
  const dynamicHeight = Math.max(calculatedHeight, minHeight);
  const dishColor = colour || getRandomColor(label);
  const showMissing = false;

  return (
    <View style={[styles.matrixWrapper, { width: dynamicWidth, height: dynamicHeight }]}>
      <Text style={styles.dishTitle} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.matrixContainer}>
        {matrix.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((cell, colIndex) => {
              if (!cell) {
                return (
                  <View
                    key={colIndex}
                    style={[
                      styles.cell,
                      { width: cellSize, height: cellSize, margin: cellMargin, backgroundColor: "#ccc" },
                    ]}
                  />
                );
              }
              const confirmed = cell.addedIngredients.map(ai => ai.name);
              const effectiveCount = getEffectiveCount(cell.id, confirmed, cell.ingredients.length, showMissing);
              const total = cell.ingredients.length;
              const cellContent = `${effectiveCount}/${total}`;

              // If any selected ingredient is already confirmed in this bag, mark it with a red border.
              const isCellExhausted = selectedIngredients.some(sel =>
                cell.addedIngredients.some(ai => ai.name === sel)
              );

              const cellStyle = [
                styles.cell,
                { width: cellSize, height: cellSize, margin: cellMargin, backgroundColor: dishColor },
                isCellExhausted && { borderColor: "red", borderWidth: 2 },
              ];

              const cellView = (
                <View style={cellStyle}>
                  <Text style={styles.cellText}>{cellContent}</Text>
                </View>
              );
              return editable && onBagPress ? (
                <TouchableOpacity key={colIndex} onPress={() => onBagPress(cell.id)}>
                  {cellView}
                </TouchableOpacity>
              ) : (
                <View key={colIndex}>{cellView}</View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  matrixWrapper: {
    backgroundColor: "#1e1e1e",
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    alignItems: "center",
  },
  dishTitle: {
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
    width: "100%",
  },
  matrixContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  cellText: {
    color: "#fff",
    fontSize: 10,
    textAlign: "center",
  },
});

export default DraggableDish;
