import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { NotificationBell } from "../../components/notification-bell";
import { colors } from "../../lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.surfaceRaised, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: "IBMPlexSansArabic_600SemiBold" },
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "المسارات",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="lawha"
        options={{
          title: "اللوحة",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="hisabi"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
