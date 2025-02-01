import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { PrepBag } from "@/types/prepBags";
import { computeEffectiveCount } from "@/utils/ingredientUtils";
type DraggableDishProps = {
  label: string;
  matrix: (PrepBag | null)[][];
  colour?: string;
  editable?: boolean; // Cells become pressable for ingredient editing.
  onBagPress?: (bagId: string) => void;
  // pendingUpdates maps bag id to a record mapping ingredient name to boolean.
  pendingUpdates?: Record<string, Record<string, boolean>>;
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



const DraggableDish: React.FC<DraggableDishProps> = memo(
  ({ matrix, label, colour, editable, onBagPress, pendingUpdates }) => {
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
    const showMissing = false; // Toggle to show missing vs. added count.

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
                        {
                          width: cellSize,
                          height: cellSize,
                          margin: cellMargin,
                          backgroundColor: "#ccc",
                        },
                      ]}
                    />
                  );
                }
                const confirmed = cell.addedIngredients.map((ai) => ai.name);
                const pendingForBag =
                  pendingUpdates && pendingUpdates[cell.id] ? pendingUpdates[cell.id] : {};
                const effectiveCount = computeEffectiveCount(
                  confirmed,
                  pendingForBag,
                  cell.ingredients.length,
                  showMissing
                );
                const total = cell.ingredients.length;
                const cellContent = `${effectiveCount}/${total}`;
                const cellView = (
                  <View
                    style={[
                      styles.cell,
                      {
                        width: cellSize,
                        height: cellSize,
                        margin: cellMargin,
                        backgroundColor: dishColor,
                      },
                    ]}
                  >
                    <Text style={styles.cellText}>{cellContent}</Text>
                  </View>
                );
                if (editable && onBagPress) {
                  return (
                    <TouchableOpacity key={colIndex} onPress={() => onBagPress(cell.id)}>
                      {cellView}
                    </TouchableOpacity>
                  );
                }
                return <View key={colIndex}>{cellView}</View>;
              })}
            </View>
          ))}
        </View>
      </View>
    );
  }
);

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
