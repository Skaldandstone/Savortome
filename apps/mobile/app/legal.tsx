import { Link } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/ui';

export default function LegalScreen() {
  const c = usePalette();
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>About Savortome™</Text>
      <Text style={{ color: c.text, fontSize: 16, lineHeight: 24 }}>© 2026 Skald and Stone LLC</Text>
      <Text style={{ color: c.text, fontSize: 16, lineHeight: 24 }}>This notice covers original software and studio content. Imported recipes, source media, and user content belong to their respective owners. Existing software licenses remain unchanged.</Text>
      <Link href="/" style={{ color: c.accent, fontSize: 16, minHeight: 48, paddingVertical: 12 }}>Back to Savortome</Link>
    </ScrollView>
  </SafeAreaView>;
}
