import { Tabs, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePalette } from "@/ui";

/**
 * The six things you do with the app. Labels rather than icons: no icon
 * package is installed, and a wrong-looking icon reads worse than a clear word.
 */
export default function TabsLayout() {
  const c = usePalette();

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: c.surface }}>
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
      <Tabs.Screen name="plan" options={{ title: "Plan" }} />
      <Tabs.Screen name="cook" options={{ title: "Cook" }} />
      <Tabs.Screen name="list" options={{ title: "List" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
    </Tabs>
    <Link href="/legal" style={{ color: c.text, textAlign: "center", padding: 12, minHeight: 44, fontSize: 14 }}>About Second Breakfast and legal</Link>
    </SafeAreaView>
  );
}
