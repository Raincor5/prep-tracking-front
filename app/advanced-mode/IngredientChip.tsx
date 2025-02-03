// app/advanced-mode/IngredientChip.tsx
// A component that displays an ingredient chip.
// Purpose: This component displays an ingredient chip that can be selected or deselected by the user.

import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";

export type IngredientChipProps = {
  name: string;
  selected: boolean;
  onToggle: () => void;
  exhausted?: boolean;
};

export function IngredientChip({ name, selected, onToggle, exhausted = false }: IngredientChipProps) {
  return (
    <TouchableOpacity onPress={onToggle}>
      <View
        style={[
          styles.ingredientChip,
          selected && { backgroundColor: "#4CAF50" },
          exhausted && { borderColor: "red", borderWidth: 2 }
        ]}
      >
        <Text style={styles.ingredientChipText}>{name}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  ingredientChip: {
    backgroundColor: "#333",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 5,
  },
  ingredientChipText: {
    color: "#fff",
    fontSize: 14,
  },
});
