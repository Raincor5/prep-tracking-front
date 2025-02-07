// app/advanced-mode/DraggableDish.tsx
// A component that displays a draggable dish with prep bags.
// Purpose: This component displays a draggable dish with prep bags that can be swiped over to add ingredients.
// The swipe handler is enabled only when the gesture manager indicates that swipe is enabled.
// Additionally, when a bag is swiped over, a small scale animation is triggered to visually indicate the action,
// and if a bag is complete (i.e. full) or an ingredient is exhausted, a red border is applied.
import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { PanGestureHandler, State as GestureState } from "react-native-gesture-handler";
import { PrepBag } from "@/types/prepBags";
import { useIngredientsContext } from "@/context/IngredientsContext";

export type DraggableDishProps = {
  dishId: string;
  label: string;
  matrix: (PrepBag | null)[][];
  colour?: string;
  editable?: boolean;
  onBagPress?: (bagId: string) => void;
  selectedIngredients?: string[];
  // Prop from parent to control whether swipe gesture is enabled.
  isSwipeEnabled: boolean;
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

const DraggableDish: React.FC<DraggableDishProps> = ({
  dishId,
  label,
  matrix,
  colour,
  editable,
  onBagPress,
  selectedIngredients = [],
  isSwipeEnabled,
}) => {
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

  // Base style for each cell.
  const baseCellStyle = { width: cellSize, height: cellSize, margin: cellMargin };

  // Local state for measuring bag cell absolute layouts.
  const [bagLayouts, setBagLayouts] = React.useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  // Local ref to track which bag cells have been triggered during a gesture.
  const activatedBagsRef = useRef<Set<string>>(new Set());
  // Ref to hold animation values for each cell.
  const cellAnimations = useRef<Record<string, Animated.Value>>({});

  const updateCellLayout = useCallback(
    (bagId: string, layout: { x: number; y: number; width: number; height: number }) => {
      setBagLayouts((prev) => ({ ...prev, [bagId]: layout }));
    },
    []
  );

  // Translation threshold to avoid accidental triggers.
  const translationThreshold = 5;

  // The pan gesture callback for the dish.
  const onGestureEvent = useCallback(
    (event: any) => {
      if (!isSwipeEnabled || selectedIngredients.length === 0) return;
      const { absoluteX, absoluteY, translationX, translationY } = event.nativeEvent;
      if (Math.abs(translationX) < translationThreshold && Math.abs(translationY) < translationThreshold)
        return;
      Object.entries(bagLayouts).forEach(([bagId, layout]) => {
        const withinX = absoluteX >= layout.x && absoluteX <= layout.x + layout.width;
        const withinY = absoluteY >= layout.y && absoluteY <= layout.y + layout.height;
        if (withinX && withinY && !activatedBagsRef.current.has(bagId)) {
          console.log("Swiped over bag:", bagId);
          activatedBagsRef.current.add(bagId);
          // Trigger cell animation.
          if (cellAnimations.current[bagId]) {
            Animated.sequence([
              Animated.timing(cellAnimations.current[bagId], { toValue: 1.1, duration: 100, useNativeDriver: true }),
              Animated.timing(cellAnimations.current[bagId], { toValue: 1, duration: 100, useNativeDriver: true }),
            ]).start();
          }
          if (onBagPress) onBagPress(bagId);
        }
      });
    },
    [bagLayouts, selectedIngredients, onBagPress, isSwipeEnabled]
  );

  const onHandlerStateChange = useCallback((event: any) => {
    if (
      event.nativeEvent.state === GestureState.BEGAN ||
      event.nativeEvent.state === GestureState.END ||
      event.nativeEvent.state === GestureState.CANCELLED
    ) {
      activatedBagsRef.current.clear();
    }
  }, []);

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      enabled={isSwipeEnabled}
    >
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
                      style={[styles.cell, { ...baseCellStyle, backgroundColor: "#ccc" }]}
                    />
                  );
                }
                const confirmed = cell.addedIngredients.map((ai) => ai.name);
                const effectiveCount = getEffectiveCount(
                  cell.id,
                  confirmed,
                  cell.ingredients.length,
                  showMissing
                );
                const total = cell.ingredients.length;
                const cellContent = `${effectiveCount}/${total}`;

                const isComplete = cell.isComplete;
                const isCellExhausted = selectedIngredients.some((sel) =>
                  cell.addedIngredients.some((ai) => ai.name === sel)
                );
                const cellBackground = isComplete ? "green" : dishColor;
                const borderStyle = (isComplete || isCellExhausted)
                  ? { borderColor: "red", borderWidth: 2 }
                  : {};
                let cellStyle = [
                  styles.cell,
                  { ...baseCellStyle, backgroundColor: cellBackground },
                  borderStyle,
                ];

                if (!cellAnimations.current[cell.id]) {
                  cellAnimations.current[cell.id] = new Animated.Value(1);
                }
                const scaleVal = cellAnimations.current[cell.id];

                const cellRef = useRef<View>(null);
                useEffect(() => {
                  if (cellRef.current) {
                    cellRef.current.measureInWindow((x, y, width, height) => {
                      updateCellLayout(cell.id, { x, y, width, height });
                    });
                  }
                }, [cellRef.current]);

                const cellView = (
                  <Animated.View ref={cellRef} style={[cellStyle, { transform: [{ scale: scaleVal }] }]}>
                    <Text style={styles.cellText}>{cellContent}</Text>
                  </Animated.View>
                );

                return onBagPress ? (
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
    </PanGestureHandler>
  );
};

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

export default React.memo(DraggableDish) as React.FC<DraggableDishProps>;
