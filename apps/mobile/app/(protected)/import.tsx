import { Stack } from "expo-router";
import { ImportScreen } from "@/modules/import";

/** Pushed over the tabs: importing is a task you finish and come back from. */
export default function ImportRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Import a recipe" }} />
      <ImportScreen />
    </>
  );
}
