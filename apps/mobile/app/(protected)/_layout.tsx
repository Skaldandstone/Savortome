import { Stack } from 'expo-router';
import { AuthGate } from '@/modules/account';
import { useReducedMotion } from '@/ui/ThemeProvider';
export default function ProtectedLayout() {
  const reducedMotion = useReducedMotion();
  return <AuthGate><Stack screenOptions={{headerShown:false,animation:reducedMotion ? 'none' : 'default'}} /></AuthGate>;
}
