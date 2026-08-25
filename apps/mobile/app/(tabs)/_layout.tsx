import { Tabs } from "expo-router";
import { usePalette } from "@/ui";

/**
 * The five things you do with the app. Labels rather than icons: no icon
 * package is installed, and a wrong-looking icon reads worse than a clear word.
 */
export default function TabsLayout() {
  const c = usePalette();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Library" }} />
      <Tabs.Screen name="cook" options={{ title: "Cook" }} />
      <Tabs.Screen name="list" options={{ title: "List" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
    </Tabs>
  );
}
