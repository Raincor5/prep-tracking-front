import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { RecipeProvider } from '@/context/RecipeContext';
import { DishesProvider } from '@/context/DishesContext';
import { useColorScheme } from '@/components/useColorScheme';
import { IngredientsProvider } from '@/context/IngredientsContext';
import { GestureManagerProvider } from '@/context/GestureManagerContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.gestureHandlerRoot}>
      <GestureManagerProvider>
        <RecipeProvider>
          <DishesProvider>
            <IngredientsProvider>
              <RootLayoutNav />
            </IngredientsProvider>
          </DishesProvider>
        </RecipeProvider>
      </GestureManagerProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="recipe-detail"
          options={{ title: 'Recipe Details', presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="advanced-mode/index"
          options={{
            headerShown: false, // Hide header for full-screen view
            gestureEnabled: true,
            presentation: 'modal', // Present as modal
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  gestureHandlerRoot: {
    flex: 1,
  },
});
