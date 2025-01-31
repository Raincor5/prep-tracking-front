// app/advanced-mode/DraggableDish.tsx

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { PrepBag } from "@/types/prepBags";

// The DraggableDish gets an optional 'colour'.
type DraggableDishProps = {
  label: string;
  matrix: (PrepBag | null)[][];
  colour?: string;
};

// If no dish.colour is present, we fallback to random per dish
const COLOR_POOL = ["#f94144","#f3722c","#f9c74f","#90be6d","#43aa8b","#577590"];
let availableColors = [...COLOR_POOL];
const dishColorMap: Record<string, string> = {};

// We only call this if there's no .colour present.
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

const DraggableDish: React.FC<DraggableDishProps> = memo(({ matrix, label, colour }) => {
  const cellSize = 50;
  const cellMargin = 2;

  const numRows = matrix.length;
  const numCols = numRows > 0 ? matrix[0].length : 0;

  const dynamicWidth = numCols * (cellSize + cellMargin * 2) + 20;
  const dynamicHeight = numRows * (cellSize + cellMargin * 2) + 40;

  // Decide if we have a dish-specified color or if we must fallback:
  const dishColor = colour || getRandomColor(label);

  return (
    <View
      style={[
        styles.matrixWrapper,
        { width: dynamicWidth, height: dynamicHeight },
      ]}
    >
      <Text style={styles.dishTitle}>{label}</Text>

      {matrix.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell, colIndex) => {
            // If cell is null, background is "#ccc" for an empty slot
            const bgColor = cell ? dishColor : "#ccc";

            return (
              <View
                key={colIndex}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    margin: cellMargin,
                    backgroundColor: bgColor,
                  },
                ]}
              >
                <Text style={styles.cellText}>{cell ? cell.id : ""}</Text>
              </View>
            );
          })}
        </View>
      ))}
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
  },
  dishTitle: {
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
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
