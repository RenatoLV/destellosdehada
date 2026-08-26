import React from 'react';
import { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7B5CF6',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
            <Feather name="home" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventario"
        options={{
          title: 'Inventario',
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
            <Feather name="box" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="ventas"
        options={{
          title: 'Ventas',
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
            <Feather name="tag" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: 'Más',
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
            <Feather name="more-horizontal" size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}