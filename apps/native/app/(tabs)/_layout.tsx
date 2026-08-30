import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { NotificationBell } from "../../components/notification-bell";
import { useTheme } from "../../lib/theme-context";

export default function TabsLayout() {
  const { colors, scheme } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surfaceRaised,
          borderTopColor: scheme === "dark" ? colors.hairline : colors.border,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: "IBMPlexSansArabic_600SemiBold", fontSize: 12 },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: "Cairo_700Bold" },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.surface },
        /** The bell rides in every tab's header, so it is reachable from anywhere. */
        headerRight: () => <NotificationBell />,
      }}
    >
      <Tabs.Screen
        name="mustajaddat"
        options={{
          title: "المستجدّات",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "newspaper" : "newspaper-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "المسارات",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="lawha"
        options={{
          title: "اللوحة",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "trophy" : "trophy-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="hisabi"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
