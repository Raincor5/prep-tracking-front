// Updated Tabs Layout for Prep Tracking App
import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// TabBarIcon helper function
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
        }}
      />

      {/* Prep Tab */}
      <Tabs.Screen
        name="two"
        options={{
          title: 'Prep Grid',
          tabBarIcon: ({ color }) => <TabBarIcon name="th" color={color} />,
        }}
      />

      {/* Upload Recipe Tab */}
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload Recipe',
          tabBarIcon: ({ color }) => <TabBarIcon name="camera" color={color} />,
        }}
      />
    </Tabs>
  );
}
