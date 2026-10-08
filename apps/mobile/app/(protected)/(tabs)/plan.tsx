import { PlanScreen } from "@/modules/plan";
import { useMemo } from "react";
import { Text } from "react-native";
import { useAuth } from "@clerk/expo";
import { useLocalSearchParams } from "expo-router";
import { foodLogDate, todayISO, weekStart } from "@seconds/core/format";
import { createAccountClient } from "@/lib/client";

export default function PlanRoute() {
  const { userId, sessionId, isLoaded } = useAuth();
  const params = useLocalSearchParams<{ week?: string | string[] }>();
  const client = useMemo(() => userId ? createAccountClient(userId) : null, [userId, sessionId]);
  let week = weekStart(todayISO());
  try { if (typeof params.week === "string") week = weekStart(foodLogDate(params.week)); } catch { /* Malformed handoffs never choose another user's data. */ }
  if (!isLoaded) return <Text accessibilityLiveRegion="polite">Loading your sign-in…</Text>;
  if (!client || !sessionId) return <Text>Sign in to load your meal plan.</Text>;
  return <PlanScreen key={`${sessionId}:${week}`} initialWeek={week} client={client} />;
}
