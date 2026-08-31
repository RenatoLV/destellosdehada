import React from 'react';
import { ColorValue, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3E1F5C',
        tabBarInactiveTintColor: '#8C8390',
        tabBarStyle: {
          backgroundColor: '#FFFDF9',
          borderTopWidth: 1,
          borderTopColor: '#E3DBD1',
          height: Platform.OS === 'ios' ? 56 + insets.bottom : 64,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          elevation: 8,
          boxShadow: '0px -2px 4px rgba(36, 21, 54, 0.08)',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventario"
        options={{
          title: 'Catálogo',
          tabBarIcon: ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
            <Feather name="box" size={20} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="ventas"
        options={{
          title: 'Ventas',
          tabBarIcon: ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
            <Feather name="shopping-bag" size={20} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: 'Más',
          tabBarIcon: ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
            <Feather name="grid" size={20} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
