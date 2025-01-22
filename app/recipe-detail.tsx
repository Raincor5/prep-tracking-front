import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function RecipeDetail() {
  const params = useLocalSearchParams();

  let recipe;
  try {
    recipe = params.recipe ? JSON.parse(params.recipe as string) : null;
  } catch (error) {
    console.error('Error parsing recipe:', error);
    Alert.alert('Error', 'Failed to load recipe details.');
    recipe = null;
  }

  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Invalid recipe data.</Text>
      </View>
    );
  }

  return (
    <View style={styles.modalContainer}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{recipe.name}</Text>
        <Text style={styles.portion}>Portion: {recipe.originalPortion}</Text>

        {recipe.ingredients && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients:</Text>
            {recipe.ingredients.map((ingredient: any, index: number) => (
              <Text key={index} style={styles.text}>
                - {ingredient.name}: {ingredient.weight} {ingredient.unit}
              </Text>
            ))}
          </View>
        )}

        {recipe.steps && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Steps:</Text>
            {recipe.steps.map((step: string, index: number) => (
              <Text key={index} style={styles.text}>
                {index + 1}. {step}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e', // Darker background for modal
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000', // Shadow for modal
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5, // Shadow for Android
  },
  content: {
    paddingBottom: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#4CAF50', // Accent green color for title
    marginBottom: 10,
  },
  portion: {
    fontSize: 16,
    color: '#b0b0b0',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#2e2e2e', // Slightly lighter background for sections
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    color: '#ffffff', // Lighter text for better readability
  },
  errorText: {
    fontSize: 18,
    color: '#ff6f61', // Error red color for errors
    textAlign: 'center',
    marginTop: 20,
  },
});
